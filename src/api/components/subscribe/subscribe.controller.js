/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import * as SettingsModel from '../settings/settings.model.js';

export const getKeys = async (req, res) => {
  try {
    const webpush = await SettingsModel.getByTarget(false, 'webpush');
    res.status(200).send(webpush);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const subscribe = async (req, res) => {
  try {
    if (!req.body || !req.body.endpoint) {
      res.status(400).send({
        error: {
          id: 'no-endpoint',
          message: 'Subscription must have an endpoint.',
        },
      });
    } else {
      await SettingsModel.patchByTarget(false, 'webpush', {
        subscription: req.body,
      });

      res.status(204).send({});
    }
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
