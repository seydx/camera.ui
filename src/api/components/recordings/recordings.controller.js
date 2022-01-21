/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import * as RecordingsModel from './recordings.model.js';

export const insert = async (req, res) => {
  try {
    let recording = await RecordingsModel.findById(req.body.id);

    if (recording) {
      return res.status(409).send({
        statusCode: 409,
        message: 'Recording already exists',
      });
    }

    recording = await RecordingsModel.createRecording(req.body);

    res.status(201).send(recording);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const list = async (req, res, next) => {
  try {
    if (req.query.refresh === 'true') {
      await RecordingsModel.refresh();
    }

    res.locals.items = await RecordingsModel.list(req.query);

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
    if (req.query.refresh === 'true') {
      await RecordingsModel.refresh();
    }

    const recording = await RecordingsModel.findById(req.params.id);

    if (!recording) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Recording not exists',
      });
    }

    res.status(200).send(recording);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const removeById = async (req, res) => {
  try {
    if (req.query.refresh === 'true') {
      await RecordingsModel.refresh();
    }

    const recording = await RecordingsModel.findById(req.params.id);

    if (!recording) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Recording not exists',
      });
    }

    await RecordingsModel.removeById(req.params.id);

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
    await RecordingsModel.removeAll();

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
