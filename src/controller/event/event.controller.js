'use strict';

import got from 'got';
import { customAlphabet } from 'nanoid/async';
import moment from 'moment';
import { RekognitionClient, DetectLabelsCommand } from '@aws-sdk/client-rekognition';
import { URL } from 'url';
import webpush from 'web-push';

import Alexa from '../../common/alexa.js';
import Telegram from '../../common/telegram.js';

import LoggerService from '../../services/logger/logger.service.js';

import Socket from '../../api/socket.js';

import * as CamerasModel from '../../api/components/cameras/cameras.model.js';
import * as NotificationsModel from '../../api/components/notifications/notifications.model.js';
import * as RecordingsModel from '../../api/components/recordings/recordings.model.js';
import * as SettingsModel from '../../api/components/settings/settings.model.js';

const { log } = LoggerService;

const nanoid = customAlphabet('1234567890abcdef', 10);

const stringIsAValidUrl = (s) => {
  try {
    let url = new URL(s);
    return url;
  } catch {
    return false;
  }
};

export default class EventController {
  static #controller;
  static #movementHandler = {};

  constructor(controller) {
    EventController.#controller = controller;

    EventController.#controller.on('uiMotion', (event) =>
      EventController.handle(event.triggerType, event.cameraName, event.state)
    );

    this.triggerEvent = EventController.handle;
  }

  // eslint-disable-next-line no-unused-vars
  static async handle(trigger, cameraName, active, fileBuffer, type) {
    if (active) {
      try {
        const database = await SettingsModel.show(true);

        const SettingsDB = database.settings;
        const Camera = database.cameras.find((camera) => camera.name === cameraName);
        const CameraSettings = database.settings.cameras.find((camera) => camera.name === cameraName);

        if (Camera && Camera.videoConfig) {
          const awsSettings = {
            active: SettingsDB.aws.active,
            accessKeyId: SettingsDB.aws.accessKeyId,
            secretAccessKey: SettingsDB.aws.secretAccessKey,
            region: SettingsDB.aws.region,
            contingent_total: SettingsDB.aws.contingent_total,
            contingent_left: SettingsDB.aws.last_rekognition
              ? moment(SettingsDB.aws.last_rekognition).isSame(new Date(), 'month')
                ? SettingsDB.aws.contingent_left >= 0
                  ? SettingsDB.aws.contingent_left
                  : SettingsDB.aws.contingent_total
                : SettingsDB.aws.contingent_total
              : SettingsDB.aws.contingent_total,
            last_rekognition: SettingsDB.aws.last_rekognition,
          };

          const notificationsSettings = {
            active: SettingsDB.notifications.active,
          };

          const recordingSettings = {
            active: SettingsDB.recordings.active,
            path: SettingsDB.recordings.path,
            timer: SettingsDB.recordings.timer,
            type: SettingsDB.recordings.type,
          };

          const alexaSettings = {
            active: SettingsDB.notifications.alexa.active,
            domain: SettingsDB.notifications.alexa.domain,
            serialNr: SettingsDB.notifications.alexa.serialNr,
            auth: SettingsDB.notifications.alexa.auth,
            proxy: SettingsDB.notifications.alexa.proxy,
            message: SettingsDB.notifications.alexa.message,
            startTime: SettingsDB.notifications.alexa.startTime,
            endTime: SettingsDB.notifications.alexa.endTime,
            enabled: CameraSettings.alexa,
          };

          const telegramSettings = {
            active: SettingsDB.notifications.telegram.active,
            token: SettingsDB.notifications.telegram.token,
            chatID: SettingsDB.notifications.telegram.chatID,
            message: SettingsDB.notifications.telegram.message,
            type: CameraSettings.telegramType,
          };

          const webhookSettings = {
            active: SettingsDB.notifications.webhook.active,
            endpoint: CameraSettings.webhookUrl,
          };

          const webpushSettings = {
            publicKey: SettingsDB.webpush.publicKey,
            privateKey: SettingsDB.webpush.privateKey,
            subscription: SettingsDB.webpush.subscription,
          };

          if (!EventController.#movementHandler[cameraName] || fileBuffer) {
            EventController.#movementHandler[cameraName] = true;

            /*
             * Movement Event flow
             *
             * 1) Publish mqtt message
             * 2) If webhook enabled, send webhook notification
             * 3) If recording not enabled, send ui notification banner and webpush
             * 4) If alexa enabled, send notification to alexa
             * 5) If telegram enabled and type = "Text" for the camera, send telegram notification
             * 6) Handle recording (Snapshot/Video)
             * 7) If recording enabled, send ui notification banner with media and webpush
             * 8) If telegram enabled and type = "Snapshot" or "Video" for the camera, send additional telegram notification
             */

            log.debug(`New ${trigger} alert`, cameraName);

            const motionInfo = await EventController.#getMotionInfo(cameraName, trigger, recordingSettings);

            //not used atm
            let allowStream = true;

            /*if (controller && !fileBuffer && recordingSettings.active && !Camera.prebuffering) {
              allowStream = controller.session.requestSession();
            }*/

            if (fileBuffer) {
              motionInfo.label = trigger || 'no label';
              motionInfo.type = type || 'Video';
            }

            if (allowStream) {
              const diskSpace = Socket.diskSpace;
              const allowRecording = Boolean(diskSpace.available >= 1) || Boolean(diskSpace.available === null);

              if (!allowRecording) {
                log.warn(
                  `The available disk space is less than 1 GB (${diskSpace.available.toFixed(
                    2
                  )} GB)! Please free up disk space to be able to create new recordings!`,
                  cameraName
                );

                log.info('Skip local storage of the recording..', cameraName);
              }

              if (!fileBuffer) {
                if (recordingSettings.active) {
                  if (allowRecording) {
                    motionInfo.imgBuffer = await EventController.#handleSnapshot(Camera);
                    motionInfo.label = await EventController.#handleImageDetection(
                      cameraName,
                      awsSettings,
                      CameraSettings.rekognition.labels,
                      CameraSettings.rekognition.confidence,
                      motionInfo.imgBuffer,
                      CameraSettings.rekognition.active
                    );
                  }
                } else {
                  log.debug('Recording not enabled, skip Image Rekognition..', cameraName);
                }
              }

              if (motionInfo.label) {
                const { notification, notify } = await EventController.#handleNotification(motionInfo);

                // 1)
                if (notificationsSettings.active) {
                  await EventController.#publishMqtt(cameraName, notification);
                } else {
                  log.debug('Notifications not enabled, skip MQTT (notification)..', cameraName);
                }

                // 2)
                if (notificationsSettings.active) {
                  await EventController.#sendWebhook(cameraName, notification, webhookSettings);
                } else {
                  log.debug('Notifications not enabled, skip Webhook..', cameraName);
                }

                // 3)
                if (!recordingSettings.active || !allowRecording) {
                  if (notificationsSettings.active) {
                    log.notify(notify);

                    await EventController.#sendWebpush(cameraName, notification, webpushSettings);
                  } else {
                    log.debug('Notifications not enabled, skip Webpush..', cameraName);
                  }
                }

                // 4)
                if (notificationsSettings.active) {
                  await EventController.#sendAlexa(cameraName, alexaSettings);
                } else {
                  log.debug('Notifications not enabled, skip Alexa..', cameraName);
                }

                // 5)
                if (telegramSettings.type === 'Text' || !allowRecording) {
                  if (notificationsSettings.active) {
                    await EventController.#sendTelegram(
                      cameraName,
                      notification,
                      recordingSettings,
                      telegramSettings,
                      false,
                      fileBuffer,
                      allowRecording
                    );
                  } else {
                    log.debug('Notifications not enabled, skip Telegram..', cameraName);
                  }
                }

                // 6)
                if (recordingSettings.active) {
                  if (allowRecording) {
                    await EventController.#handleRecording(cameraName, motionInfo, fileBuffer);
                  }
                } else {
                  log.debug('Recording not enabled, skip recording..', cameraName);
                }

                // 7)
                if (recordingSettings.active) {
                  if (notificationsSettings.active) {
                    if (allowRecording) {
                      log.notify(notify);

                      await EventController.#sendWebpush(cameraName, notification, webpushSettings);
                    }
                  } else {
                    log.debug('Notifications not enabled, skip Webpush..', cameraName);
                  }
                }

                // 8)
                if (
                  (telegramSettings.type === 'Text + Snapshot' ||
                    telegramSettings.type === 'Snapshot' ||
                    telegramSettings.type === 'Text + Video' ||
                    telegramSettings.type === 'Video') &&
                  recordingSettings.active
                ) {
                  if (notificationsSettings.active) {
                    if (allowRecording) {
                      await EventController.#sendTelegram(
                        cameraName,
                        notification,
                        recordingSettings,
                        telegramSettings,
                        false,
                        fileBuffer
                      );
                    }
                  } else {
                    log.debug('Notifications not enabled, skip Telegram..', cameraName);
                  }
                }

                log.debug(
                  `${
                    recordingSettings.active && allowRecording
                      ? 'Recording saved.'
                      : !allowRecording
                      ? 'Recording not allowed.'
                      : 'Recording skipped.'
                  } ${notificationsSettings.active ? 'Notification send.' : 'Notification skipped.'}`,
                  cameraName
                );
              } else {
                log.debug(
                  `Skip handling movement. Configured label (${CameraSettings.rekognition.labels}) not detected.`,
                  cameraName
                );
              }
            } else {
              log.warn('Max sessions exceeded.', cameraName, 'events');
            }
          } else {
            log.warn(
              'Can not handle movement, another movement currently in progress for this camera.',
              cameraName,
              'events'
            );
          }
        } else {
          log.warn(`Camera "${cameraName}" not found.`, cameraName, 'events');
        }
      } catch (error) {
        log.info('An error occured during handling motion event', cameraName, 'events');
        log.error(error, cameraName, 'events');
      }

      EventController.#movementHandler[cameraName] = false;

      /*if (controller) {
        controller.session.closeSession();
      }*/
    } else {
      log.debug(`Skip event, motion state: ${active}`, cameraName);
    }
  }

  static async #getMotionInfo(cameraName, trigger, recordingSettings, allowRecording) {
    const id = await nanoid();
    const timestamp = Math.round(Date.now() / 1000);

    return {
      id: id,
      camera: cameraName,
      label: null,
      path: recordingSettings.path,
      storing: Boolean(recordingSettings.active && allowRecording),
      type: recordingSettings.type,
      timer: recordingSettings.timer,
      timestamp: timestamp,
      trigger: trigger,
    };
  }

  static async #handleImageDetection(cameraName, aws, labels, confidence, imgBuffer, camRekognition) {
    if (!aws.active || !camRekognition) {
      log.debug('Image Rekognition not enabled, skip Image Rekognition..', cameraName);
      return 'no label';
    }

    if (aws.contingent_total <= 0) {
      log.debug('Contingent total is not greater 0, skip Image Rekognition..', cameraName);
      return 'no label';
    }

    if (aws.contingent_left <= 0) {
      log.debug('No contingent left, skip Image Rekognition..', cameraName);
      return 'no label';
    }

    let detected = [];

    labels = (labels || ['human', 'face', 'person']).map((label) => label.toLowerCase());
    confidence = confidence || 80;

    log.debug(`Analyzing image for following labels: ${labels.toString()}`, cameraName);

    if (aws.accessKeyId && aws.secretAccessKey && aws.region) {
      try {
        const client = new RekognitionClient({
          credentials: {
            accessKeyId: aws.accessKeyId,
            secretAccessKey: aws.secretAccessKey,
          },
          region: aws.region,
        });

        const command = new DetectLabelsCommand({
          Image: {
            Bytes: imgBuffer,
          },
          MaxLabels: 10,
          MinConfidence: 50,
        });

        let response = await client.send(command);

        detected = response.Labels.filter(
          (awsLabel) => awsLabel && labels.includes(awsLabel.Name.toLowerCase()) && awsLabel.Confidence >= confidence
        ).map((awsLabel) => awsLabel.Name);

        log.debug(
          `Label with confidence >= ${confidence}% ${
            detected.length > 0 ? `found: ${detected.toString()}` : 'not found!'
          }`,
          cameraName
        );

        if (detected.length === 0) {
          response = response.Labels.map((awsLabel) => {
            return `${awsLabel.Name.toLowerCase()} (${Number.parseFloat(awsLabel.Confidence.toFixed(2))}%)`;
          });
          log.debug(`Found labels are: ${response}`, cameraName); //for debugging
        }

        await SettingsModel.patchByTarget(false, 'aws', {
          contingent_left: aws.contingent_left - 1,
          last_rekognition: moment().format('YYYY-MM-DD HH:mm:ss'),
        });
      } catch (error) {
        log.info('An error occured during image rekognition', cameraName, 'events');
        log.error(error, cameraName, 'events');
      }
    } else {
      log.warn('No AWS credentials setted up in config.json!', cameraName, 'events');
    }

    return detected.length > 0 ? detected[0] : false;
  }

  static async #handleNotification(motionInfo) {
    return await NotificationsModel.createNotification(motionInfo);
  }

  static async #handleRecording(cameraName, motionInfo, fileBuffer) {
    return await RecordingsModel.createRecording(motionInfo, fileBuffer);
  }

  static async #handleSnapshot(camera) {
    return await CamerasModel.requestSnapshot(camera);
  }

  static async #sendAlexa(cameraName, alexaSettings) {
    if (!alexaSettings.active || !alexaSettings.enabled) {
      return log.debug('Alexa not enabled, skip Alexa..', cameraName);
    }

    if (
      !alexaSettings.serialNr ||
      !alexaSettings.auth?.cookie ||
      !alexaSettings.auth?.macDms?.device_private_key ||
      !alexaSettings.auth?.macDms?.adp_token
    ) {
      return log.debug('Alexa not configured, skip Alexa..', cameraName);
    }

    try {
      if (alexaSettings.message) {
        alexaSettings.message = alexaSettings.message.includes('@')
          ? alexaSettings.message.replace('@', cameraName)
          : alexaSettings.message;
      } else {
        alexaSettings.message = `Attention! ${cameraName} has detected motion!`;
      }

      if (alexaSettings.startTime && alexaSettings.endTime) {
        const format = 'HH:mm';
        const currentTime = moment();

        const startTime = moment(alexaSettings.startTime, format);
        const endTime = moment(alexaSettings.endTime, format);

        if ((startTime.hour() >= 12 && endTime.hour() <= 12) || endTime.isBefore(startTime)) {
          endTime.add(1, 'days');

          if (currentTime.hour() <= 12) {
            currentTime.add(1, 'days');
          }
        }

        if (!currentTime.isBetween(startTime, endTime)) {
          log.debug(
            `Current time is not between given start (${alexaSettings.startTime}) / endtime (${alexaSettings.endTime}), skip alexa notification`,
            cameraName
          );

          return;
        }
      }

      await Alexa.send(alexaSettings);
    } catch (error) {
      log.info('An error occured during sending notification to alexa', cameraName, 'events');
      log.error(error, cameraName, 'events');
    }
  }

  static async #sendTelegram(
    cameraName,
    notification,
    recordingSettings,
    telegramSettings,
    imgBuffer,
    customBuffer,
    allowRecording
  ) {
    if (!telegramSettings.active || telegramSettings.type === 'Disabled') {
      return log.debug('Telegram not enabled, skip Telegram..', cameraName);
    }

    if (!telegramSettings.token || !telegramSettings.chatID) {
      return log.debug('Telegram not configured, skip Telegram..', cameraName);
    }

    try {
      await Telegram.start({ token: telegramSettings.token });

      if (telegramSettings.message) {
        telegramSettings.message = telegramSettings.message.includes('@')
          ? telegramSettings.message.replace('@', cameraName)
          : telegramSettings.message;
      }

      switch (telegramSettings.type) {
        case 'Text': {
          //Message
          if (telegramSettings.message) {
            const content = {
              message: telegramSettings.message,
              fileName: notification.fileName,
            };

            await Telegram.send(telegramSettings.chatID, content);
          } else {
            log.debug('Can not send telegram notification (message). No telegram message defined!', cameraName);
          }

          break;
        }
        case 'Snapshot':
        case 'Text + Snapshot': {
          //Snapshot
          if (recordingSettings.active || imgBuffer || customBuffer || allowRecording !== undefined) {
            if (telegramSettings.type === 'Snapshot' && allowRecording !== undefined) {
              return;
            }

            const content = {};

            if (telegramSettings.type === 'Text + Snapshot' && telegramSettings.message) {
              content.message = telegramSettings.message;
            }

            if (allowRecording === undefined) {
              content.fileName = notification.fileName;

              if (imgBuffer) {
                content.img = imgBuffer;
              } else {
                const fileName =
                  customBuffer || recordingSettings.type === 'Video'
                    ? `${notification.name}@2.jpeg`
                    : notification.fileName;

                content.img = `${recordingSettings.path}/${fileName}`;
              }
            }

            await Telegram.send(telegramSettings.chatID, content);
          } else {
            log.debug(
              'Can not send telegram notification (snapshot). Recording not active or malformed image fileBuffer!',
              cameraName
            );
          }

          break;
        }
        case 'Video':
        case 'Text + Video': {
          if (
            (recordingSettings.active && recordingSettings.type === 'Video') ||
            customBuffer ||
            allowRecording !== undefined
          ) {
            if (telegramSettings.type === 'Video' && allowRecording !== undefined) {
              return;
            }

            const content = {};

            if (telegramSettings.type === 'Text + Video' && telegramSettings.message) {
              content.message = telegramSettings.message;
            }

            if (allowRecording === undefined) {
              content.video = customBuffer ? customBuffer : `${recordingSettings.path}/${notification.fileName}`;
            }

            await Telegram.send(telegramSettings.chatID, content);
          }

          break;
        }
        default:
          log.warn(`Can not send telegram message, unknown telegram type (${telegramSettings.type})`, cameraName);
          break;
      }
    } catch (error) {
      log.info('An error occured during sending telegram notification', cameraName, 'events');
      log.error(error, cameraName, 'events');
    }
  }

  static async #sendWebhook(cameraName, notification, webhookSettings) {
    if (!webhookSettings.active) {
      return log.debug('Webhook not enabled, skip Webhook..', cameraName);
    }

    if (!webhookSettings.endpoint) {
      return log.debug('No Webhook endpoint defined, skip Webhook..', cameraName);
    }

    try {
      let validUrl = stringIsAValidUrl(webhookSettings.endpoint);

      if (validUrl) {
        log.debug(`Trigger Webhook endpoint ${webhookSettings.endpoint}`, cameraName);

        await got(webhookSettings.endpoint, {
          method: 'POST',
          responseType: 'json',
          json: notification,
          https: {
            rejectUnauthorized: false,
          },
        });

        log.debug(`Payload was sent successfully to ${webhookSettings.endpoint}`, cameraName);
      }
    } catch (error) {
      log.info('An error occured during sending webhook notification', cameraName, 'events');
      log.error(error, cameraName, 'events');
    }
  }

  static async #publishMqtt(cameraName, notification) {
    try {
      const mqttClient = EventController.#controller.motionController?.mqttClient;

      if (mqttClient?.connected) {
        mqttClient.publish('camera.ui/notifications', JSON.stringify(notification));
      } else {
        return log.debug('MQTT client not connected, skip MQTT (notification)..');
      }
    } catch (error) {
      log.info('An error occured during publishing mqtt message', cameraName, 'events');
      log.error(error, cameraName, 'events');
    }
  }

  static async #sendWebpush(cameraName, notification, webpushSettings) {
    if (!webpushSettings.publicKey || !webpushSettings.privateKey || !webpushSettings.subscription) {
      return log.debug('Webpush grant expired, skip Webpush..');
    }

    try {
      webpush.setVapidDetails('mailto:example@yourdomain.org', webpushSettings.publicKey, webpushSettings.privateKey);

      log.debug('Sending new webpush notification', cameraName);

      webpush.sendNotification(webpushSettings.subscription, JSON.stringify(notification)).catch(async (error) => {
        if (error.statusCode === 410) {
          log.debug('Webpush Notification Grant changed! Removing subscription..', cameraName);
          await SettingsModel.patchByTarget(false, 'webpush', { subscription: false });
        } else {
          log.info('An error occured during sending Wep-Push Notification!', cameraName, 'events');
          log.error(error.body, cameraName, 'events');
        }
      });
    } catch (error) {
      log.info('An error occured during sending webpush notification', cameraName, 'events');
      log.error(error, cameraName, 'events');
    }
  }
}
