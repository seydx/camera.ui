/* eslint-disable unicorn/catch-error-name */
/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const AlexaRemote = require('alexa-remote2');

const { LoggerService } = require('../services/logger/logger.service');

const { Database } = require('../api/database');

const { log } = LoggerService;

class Alexa {
  static remote = new AlexaRemote();

  constructor() {}

  static start(config, fromSend, ping) {
    log.debug('Initializing alexa');

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      Alexa.remote.init(
        {
          useWsMqtt: true,
          amazonPage: config.domain,
          alexaServiceHost: config.domain.endsWith('.de') ? `layla.${config.domain}` : `pitangui.${config.domain}`,
          cookie: config.auth.cookie,
          macDms: config.auth.macDms,
          proxyOwnIp: config.proxy.clientHost,
          proxyPort: config.proxy.port,
        },
        async (error) => {
          if (error) {
            Alexa.remote.initialized = false;

            if (ping || fromSend) {
              return reject(error);
            }

            if (!error.message.includes('You can try to get the cookie manually by opening')) {
              reject(error);
            }

            //wait till user login
          } else {
            log.debug('Alexa initialized');

            Alexa.remote.initialized = true;

            const auth = {
              cookie: Alexa.remote.cookieData?.localCookie || Alexa.remote.cookie,
              macDms: Alexa.remote.cookieData?.macDms || Alexa.remote.macDms,
            };

            try {
              await Database.interfaceDB.read();
              await Database.interfaceDB.get('settings').get('notifications').get('alexa').set('auth', auth).write();
            } catch (e) {
              Alexa.remote = false;
              reject(e);
            }

            resolve(true);
          }
        }
      );
    });
  }

  static async connect(config) {
    try {
      if (!config) {
        await Database.interfaceDB.read();

        config = await Database.interfaceDB.get('settings').get('notifications').get('alexa').value();
      }

      const status = await Alexa.start(config, false, true);

      return status;
    } catch (error) {
      if (error.includes('You can try to get the cookie manually by opening') && Alexa.remote?.alexaCookie) {
        Alexa.remote.alexaCookie.stopProxyServer();
      }

      return false;
    }
  }

  static async send(alexaSettings) {
    try {
      if (Alexa.remote) {
        if (!Alexa.remote.initialized) {
          await Alexa.start(alexaSettings, true);
        }

        if (!alexaSettings) {
          throw new Error('Malformed data!');
        }

        if (!alexaSettings.serialNr) {
          throw new Error('No serialNr defined!');
        }

        if (!alexaSettings.message) {
          throw new Error('No message defined!');
        }

        log.debug(`Alexa: Sending message: ${alexaSettings.message}`);

        const value = `<speak>${alexaSettings.message}</speak>`;

        return new Promise((resolve, reject) => {
          Alexa.remote.sendSequenceCommand(alexaSettings.serialNr, 'ssml', value, (error, data) => {
            if (error) {
              return reject(error);
            }
            resolve(data);
          });
        });
      } else {
        log.warn('Can not send notification alexa, alexa is not initialized!');
      }
    } catch (error) {
      if (error.includes('You can try to get the cookie manually by opening')) {
        if (Alexa.remote?.alexaCookie) {
          Alexa.remote.alexaCookie.stopProxyServer();
        }

        throw new Error('Please re-connect to alexa in your interface settings!');
      }

      throw error;
    }
  }
}

exports.Alexa = Alexa;
