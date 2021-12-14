'use-strict';

const { Telegraf } = require('telegraf');

const { LoggerService } = require('../services/logger/logger.service');

const { log } = LoggerService;

class Telegram {
  static bot;

  constructor() {}

  static async start(telegramConfig) {
    if (Telegram.bot) {
      return Telegram.bot;
    }

    log.debug('Connecting to Telegram...');

    Telegram.bot = new Telegraf(telegramConfig.token);

    Telegram.bot.catch((error, context) => {
      log.error('Telegram: ' + context.updateType + ' Error: ' + error.message, 'Telegram', 'notifications');
    });

    Telegram.bot.start((context) => {
      if (context.message) {
        const from = context.message.chat.title || context.message.chat.username || 'unknown';
        const message = `Chat ID for ${from}: ${context.message.chat.id}`;

        log.debug(`Telegram: ${message}`);
        context.reply(message);
      }
    });

    await Telegram.bot.launch();

    return Telegram.bot;
  }

  static async stop() {
    if (Telegram.bot) {
      log.debug('Stopping Telegram...');
      await Telegram.bot.stop();
    }
  }

  static async send(chatID, content) {
    if (Telegram.bot) {
      try {
        if (content.message) {
          log.debug('Telegram: Sending Message');
          await Telegram.bot.telegram.sendMessage(chatID, content.message);
        }

        if (content.img) {
          log.debug('Telegram: Sending Photo');
          await Telegram.bot.telegram.sendPhoto(chatID, { source: content.img });
        } else if (content.video) {
          log.debug('Telegram: Sending Video');
          await Telegram.bot.telegram.sendVideo(chatID, { source: content.video });
        }
      } catch (error) {
        log.info('An error occured during sending telegram message!', 'Telegram', 'notifications');
        log.error(error, 'Telegram', 'notifications');
      }
    } else {
      log.warn('Can not send Telegram notification, bot is not initialized!', 'Telegram', 'notifications');
    }
  }
}

exports.Telegram = Telegram;
