/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const ConfigModel = require('./config.model');

exports.show = async (req, res) => {
  try {
    const result = await ConfigModel.show(req.jwt, req.query.target);

    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.patchConfig = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).send({
        statusCode: 400,
        message: 'Bad request',
      });
    }

    await ConfigModel.patchConfig(req.body);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
