/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import fs from 'fs-extra';
import TelegramBot from 'node-telegram-bot-api';

import LoggerService from '../services/logger/logger.service.js';

const { log } = LoggerService;

export default class Telegram {
  static bot = null;

  constructor() {}

  static async start(telegramConfig) {
    if (Telegram.bot) {
      return Telegram.bot;
    }

    log.debug('Connecting to Telegram...');

    Telegram.bot = new TelegramBot(telegramConfig.token, { polling: false, filepath: false });

    Telegram.bot.on('error', (error) => {
      log.error(error?.message || error, 'Telegram', 'notifications');
    });

    Telegram.bot.on('polling_error', (error) => {
      log.error(error?.message || error, 'Telegram', 'notifications');
    });

    Telegram.bot.on('webhook_error', (error) => {
      log.error(error?.message || error, 'Telegram', 'notifications');
    });

    return Telegram.bot;
  }

  static async stop() {
    if (Telegram.bot) {
      log.debug('Stopping Telegram...');
      await Telegram.bot.close();
      Telegram.bot = null;
    }
  }

  static async send(chatID, content) {
    if (Telegram.bot) {
      if (content.message) {
        try {
          log.debug('Telegram: Sending Message');
          await Telegram.bot.sendMessage(chatID, content.message);
        } catch (error) {
          log.info('An error occured during sending message!', 'Telegram', 'notifications');
          log.error(error?.message || error, 'Telegram', 'notifications');
        }
      }

      if (content.img) {
        try {
          log.debug('Telegram: Sending Image');
          const stream = Buffer.isBuffer(content.img) ? content.img : fs.createReadStream(content.img);
          await Telegram.bot.sendPhoto(chatID, stream, {}, { filename: content.fileName });
        } catch (error) {
          log.info('An error occured during sending image!', 'Telegram', 'notifications');
          log.error(error?.message || error, 'Telegram', 'notifications');
        }
      }

      if (content.video) {
        try {
          log.debug('Telegram: Sending Video');
          const stream = Buffer.isBuffer(content.video) ? content.video : fs.createReadStream(content.video);
          await Telegram.bot.sendVideo(chatID, stream, {}, { filename: content.fileName });
        } catch (error) {
          log.info('An error occured during sending video!', 'Telegram', 'notifications');
          log.error(error?.message || error, 'Telegram', 'notifications');
        }
      }
    } else {
      log.warn('Can not send Telegram notification, bot is not initialized!', 'Telegram', 'notifications');
    }
  }
}
