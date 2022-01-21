/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import * as NotificationsModel from './notifications.model.js';

export const insert = async (req, res) => {
  try {
    let notification = await NotificationsModel.findById(req.body.id);

    if (notification) {
      return res.status(409).send({
        statusCode: 409,
        message: 'Notification already exists',
      });
    }

    notification = await NotificationsModel.createNotification(req.body);

    res.status(201).send(notification);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const list = async (req, res, next) => {
  try {
    res.locals.items = await NotificationsModel.list(req.query);

    return next();
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getById = async (req, res) => {
  try {
    const notification = await NotificationsModel.findById(req.params.id);

    if (!notification) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Notification not exists',
      });
    }

    res.status(200).send(notification);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const removeById = async (req, res) => {
  try {
    const notification = await NotificationsModel.findById(req.params.id);

    if (!notification) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Notification not exists',
      });
    }

    await NotificationsModel.removeById(req.params.id);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const removeAll = async (req, res) => {
  try {
    await NotificationsModel.removeAll();

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
