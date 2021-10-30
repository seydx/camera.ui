'use strict';

const got = require('got');
const { customAlphabet } = require('nanoid/async');
const nanoid = customAlphabet('1234567890abcdef', 10);
const moment = require('moment');
const { RekognitionClient, DetectLabelsCommand } = require('@aws-sdk/client-rekognition');
const URL = require('url').URL;
const webpush = require('web-push');

const { Alexa } = require('../../common/alexa');
const { Telegram } = require('../../common/telegram');

const { LoggerService } = require('../../services/logger/logger.service');

const { CameraController } = require('../camera/camera.controller');

const CamerasModel = require('../../api/components/cameras/cameras.model');
const NotificationsModel = require('../../api/components/notifications/notifications.model');
const RecordingsModel = require('../../api/components/recordings/recordings.model');
const SettingsModel = require('../../api/components/settings/settings.model');

const { log } = LoggerService;

const stringIsAValidUrl = (s) => {
  try {
    let url = new URL(s);
    return url;
  } catch {
    return false;
  }
};

class EventController {
  static #movementHandler = {};
  static #motionTimers = new Map();

  constructor() {
    this.triggerEvent = EventController.handle;
  }

  // eslint-disable-next-line no-unused-vars
  static async handle(trigger, cameraName, active, buffer, type) {
    /*
     * Direct access possible (e.g. if the recording is sent by an external process).
     * Direct access requires a buffer to process the recording it.
     *
     * "trigger" should be motion, doorbell or custom.
     * "type" should be Snapshot or Video if passed with a buffer (Default: Video)
     */

    const controller = CameraController.cameras.get(cameraName);

    try {
      let Camera, CameraSettings;

      try {
        Camera = await CamerasModel.findByName(cameraName);
        CameraSettings = await CamerasModel.getSettingsByName(cameraName);
      } catch (error) {
        log.warn(error.message, cameraName);
      }

      if (Camera && Camera.videoConfig) {
        if (!buffer) {
          /*
           * When accessing via MotionController an eventTimeout should be set up to prevent massive motion events e.g. via MQTT.
           * For direct access it should be handled with its own logic.
           */

          const timeout = EventController.#motionTimers.get(cameraName);
          const timeoutConfig = !Number.isNaN(Number.parseInt(Camera.motionTimeout)) ? Camera.motionTimeout : 1;

          if (!timeout) {
            const eventTimeout = setTimeout(() => {
              log.info('Motion handler timeout.', cameraName);
              EventController.#motionTimers.delete(cameraName);
            }, timeoutConfig * 1000);

            EventController.#motionTimers.set(cameraName, eventTimeout);
          } else {
            log.warn(`Event blocked due to motionTimeout (${timeoutConfig}s)`, cameraName);
          }
        }

        const SettingsDB = await SettingsModel.show();

        const atHome = SettingsDB.general.atHome;
        const exclude = SettingsDB.general.exclude;

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

        if (!atHome || (atHome && exclude.includes(cameraName))) {
          if (!EventController.#movementHandler[cameraName] || buffer) {
            EventController.#movementHandler[cameraName] = true;

            /*
             * Order for new movement event
             *
             * 1) If webhook enabled, send webhook notification
             * 2) If alexa enabled, send notification to alexa
             * 3) If telegram enabled and type = "Text" for the camera, send telegram notification
             * 4) Handle recording (Snapshot/Video)
             * 5) Send webpush (ui) notification
             * 6) If telegram enabled and type = "Snapshot" or "Video" for the camera, send telegram notification
             */

            log.debug(`New ${trigger} alert`, cameraName);

            const motionInfo = await EventController.#getMotionInfo(cameraName, trigger, recordingSettings);

            const allowStream =
              controller && !buffer && recordingSettings.active ? controller.session.requestSession() : true;

            if (buffer) {
              // "recordOnMovement" not active because we received buffer from extern process
              motionInfo.label = 'Custom';
              motionInfo.type = type || 'Video';
            }

            if (allowStream) {
              motionInfo.imgBuffer = await EventController.#handleSnapshot(
                cameraName,
                Camera.videoConfig,
                recordingSettings.active
              );

              if (
                awsSettings.active &&
                awsSettings.contingent_total > 0 &&
                awsSettings.contingent_left > 0 &&
                CameraSettings.rekognition.active &&
                !buffer &&
                recordingSettings.active
              ) {
                motionInfo.label = await EventController.#handleImageDetection(
                  cameraName,
                  awsSettings,
                  CameraSettings.rekognition.labels,
                  CameraSettings.rekognition.confidence,
                  motionInfo.imgBuffer
                );
              }

              if (motionInfo.label || motionInfo.label === null) {
                const notification = await EventController.#handleNotification(
                  motionInfo,
                  notificationsSettings.active
                );

                // 1)
                await EventController.#sendWebhook(
                  cameraName,
                  notification,
                  webhookSettings,
                  notificationsSettings.active
                );

                // 2)
                await EventController.#sendAlexa(cameraName, notification, alexaSettings, notificationsSettings.active);

                // 3)
                if (telegramSettings.type === 'Text') {
                  await EventController.#sendTelegram(
                    cameraName,
                    notification,
                    recordingSettings,
                    telegramSettings,
                    false,
                    buffer,
                    notificationsSettings.active
                  );
                }

                // 4)
                await EventController.#handleRecording(motionInfo, buffer, recordingSettings.active);

                // 5)
                await EventController.#sendWebpush(
                  cameraName,
                  notification,
                  webpushSettings,
                  notificationsSettings.active
                );

                // 6)
                if (
                  (telegramSettings.type === 'Snapshot' || telegramSettings.type === 'Video') &&
                  recordingSettings.active
                ) {
                  await EventController.#sendTelegram(
                    cameraName,
                    notification,
                    recordingSettings,
                    telegramSettings,
                    false,
                    buffer,
                    notificationsSettings.active
                  );
                }

                log.debug(
                  `${recordingSettings.active ? 'Recording saved.' : 'Recording skipped.'} ${
                    notificationsSettings.active ? 'Notification send.' : 'Notification skipped.'
                  }`,
                  cameraName
                );
              } else {
                log.debug(
                  `Skip handling movement. Configured label (${CameraSettings.rekognition.labels}) not detected.`,
                  cameraName
                );
              }
            } else {
              log.warn('Max sessions exceeded.', cameraName);
            }
          } else {
            log.warn('Can not handle movement, another movement currently in progress for this camera.', cameraName);
          }
        } else {
          log.debug(`Skip motion trigger. At Home is active and ${cameraName} is not excluded!`, cameraName);
        }
      } else {
        log.warn(`Camera "${cameraName}" not found.`, cameraName);
      }
    } catch (error) {
      log.error('An error occured during handling motion event', cameraName);
      log.error(error, cameraName);
    }

    EventController.#movementHandler[cameraName] = false;

    if (controller) {
      controller.session.closeSession();
    }
  }

  static async #getMotionInfo(cameraName, trigger, recordingSettings) {
    const id = await nanoid();
    const timestamp = Math.round(Date.now() / 1000);

    return {
      id: id,
      camera: cameraName,
      label: null,
      path: recordingSettings.path,
      storing: recordingSettings.active,
      type: recordingSettings.type,
      timer: recordingSettings.timer,
      timestamp: timestamp,
      trigger: trigger,
    };
  }

  static async #handleImageDetection(cameraName, aws, labels, confidence, imgBuffer) {
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

        await EventController.#handleAWS({
          contingent_left: aws.contingent_left - 1,
          last_rekognition: moment().format('YYYY-MM-DD HH:mm:ss'),
        });
      } catch (error) {
        log.error('An error occured during image rekognition', cameraName);
        log.error(error, cameraName);
      }
    } else {
      log.warn('No AWS credentials setted up in config.json!', cameraName);
    }

    return detected.length > 0 ? detected[0] : false;
  }

  static async #handleAWS(awsInfo) {
    return await SettingsModel.patchByTarget('aws', awsInfo);
  }

  static async #handleNotification(motionInfo, notificationActive) {
    if (!notificationActive) {
      log.debug('Skip interface notification');
      return;
    }

    return await NotificationsModel.createNotification(motionInfo);
  }

  static async #handleRecording(motionInfo, buffer, recordingActive) {
    if (!recordingActive) {
      log.debug('Skip recording');
      return;
    }

    return await RecordingsModel.createRecording(motionInfo, buffer);
  }

  static async #handleSnapshot(cameraName, videoConfig, recordingActive) {
    if (!recordingActive) {
      return;
    }

    return await CamerasModel.requestSnapshot(cameraName, videoConfig);
  }

  static async #sendAlexa(cameraName, notification, alexaSettings, notificationActive) {
    try {
      if (
        alexaSettings.active &&
        alexaSettings.serialNr &&
        alexaSettings.auth &&
        alexaSettings.auth.cookie &&
        alexaSettings.auth.macDms &&
        alexaSettings.auth.macDms.device_private_key &&
        alexaSettings.auth.macDms.adp_token &&
        alexaSettings.enabled !== 'Disabled' &&
        notificationActive
      ) {
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
              `Start/end time has been entered (${alexaSettings.startTime} - ${alexaSettings.endTime}). Current time is not in between, skip alexa notification`,
              cameraName
            );

            return;
          }
        }

        await Alexa.send(alexaSettings);
      } else {
        log.debug('Skip alexa notification', cameraName);
      }
    } catch (error) {
      log.error('An error occured during sending notification to alexa', cameraName);
      log.error(error, cameraName);
    }
  }

  static async #sendTelegram(
    cameraName,
    notification,
    recordingSettings,
    telegramSettings,
    imgBuffer,
    customBuffer,
    notificationActive
  ) {
    try {
      if (
        telegramSettings.active &&
        telegramSettings.token &&
        telegramSettings.chatID &&
        telegramSettings.type !== 'Disabled' &&
        notificationActive
      ) {
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
              await Telegram.send(telegramSettings.chatID, {
                message: telegramSettings.message,
              });
            } else {
              log.debug('Can not send telegram notification (message). No telegram message defined!', cameraName);
            }

            break;
          }
          case 'Snapshot': {
            //Snapshot
            if (recordingSettings.active || imgBuffer || customBuffer) {
              const content = {
                message: telegramSettings.message,
              };

              if (imgBuffer) {
                content.img = imgBuffer;
              } else {
                const fileName =
                  customBuffer || recordingSettings.type === 'Video'
                    ? `${notification.name}@2.jpeg`
                    : notification.fileName;

                content.img = `${recordingSettings.path}/${fileName}`;
              }

              await Telegram.send(telegramSettings.chatID, content);
            } else {
              log.debug(
                'Can not send telegram notification (snapshot). Recording not active or malformed image buffer!',
                cameraName
              );
            }

            break;
          }
          case 'Video': {
            if ((recordingSettings.active && recordingSettings.type === 'Video') || customBuffer) {
              const content = {
                message: telegramSettings.message,
              };

              content.video = customBuffer ? customBuffer : `${recordingSettings.path}/${notification.fileName}`;

              await Telegram.send(telegramSettings.chatID, content);
            }

            break;
          }
          // No default
        }

        //await telegram.stop();
      } else {
        log.debug('Skip Telegram notification', cameraName);

        if (telegramSettings.type === 'Disabled') {
          log.debug('Telegram is disabled for this camera!', cameraName);
        }
      }
    } catch (error) {
      log.error('An error occured during sending telegram notification', cameraName);
      log.error(error, cameraName);
    }
  }

  static async #sendWebhook(cameraName, notification, webhookSettings, notificationActive) {
    try {
      if (webhookSettings.active && webhookSettings.endpoint && notificationActive) {
        let validUrl = stringIsAValidUrl(webhookSettings.endpoint);

        if (validUrl) {
          log.debug(`Trigger Webhook endpoint ${webhookSettings.endpoint}`, cameraName);

          await got(webhookSettings.endpoint, {
            method: 'POST',
            responseType: 'json',
            json: notification,
          });

          log.debug(`Payload was sent successfully to ${webhookSettings.endpoint}`, cameraName);
        }
      } else {
        log.debug('Skip Webhook notification', cameraName);
      }
    } catch (error) {
      log.error('An error occured during sending webhook notification', cameraName);
      log.error(error, cameraName);
    }
  }

  static async #sendWebpush(cameraName, notification, webpushSettings, notificationActive) {
    try {
      if (
        webpushSettings.publicKey &&
        webpushSettings.privateKey &&
        webpushSettings.subscription &&
        notificationActive
      ) {
        webpush.setVapidDetails('mailto:example@yourdomain.org', webpushSettings.publicKey, webpushSettings.privateKey);

        log.debug('Sending new webpush notification', cameraName);

        webpush.sendNotification(webpushSettings.subscription, JSON.stringify(notification)).catch(async (error) => {
          if (error.statusCode === 410) {
            log.debug('Webpush Notification Grant changed! Removing subscription..', cameraName);
            await SettingsModel.patchByTarget('webpush', { subscription: false });
          } else {
            log.error('An error occured during sending Wep-Push Notification!', cameraName);
            log.error(error.body, cameraName);
          }
        });
      } else {
        log.debug('Skip Webpush notification', cameraName);
      }
    } catch (error) {
      log.error('An error occured during sending webpush notification', cameraName);
      log.error(error, cameraName);
    }
  }
}

exports.EventController = EventController;
