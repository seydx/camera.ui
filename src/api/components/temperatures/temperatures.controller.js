/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import * as TemperaturesModel from './temperatures.model.js';

export const insert = async (req, res) => {
  try {
    let temperature = await TemperaturesModel.createNotification(req.body);

    res.status(201).send(temperature);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const list = async (req, res, next) => {
  try {
    res.locals.items = await TemperaturesModel.list(req.query);

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
    const temperature = await TemperaturesModel.findById(req.params.id);

    if (!temperature) {
      return res.status(404).send({
        statusCode: 404,
        message: 'temperature not exists',
      });
    }

    res.status(200).send(temperature);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const removeById = async (req, res) => {
  try {
    const temperature = await TemperaturesModel.findById(req.params.id);

    if (!temperature) {
      return res.status(404).send({
        statusCode: 404,
        message: 'temperature not exists',
      });
    }

    await TemperaturesModel.removeById(req.params.id);

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
    await TemperaturesModel.removeAll();

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
