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

exports.getTarget = async (req, res) => {
  try {
    const result = await ConfigModel.getByTarget(req.params.target);

    if (!result) {
      res.status(404).send({
        statusCode: 404,
        message: 'Target not found',
      });
    }

    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.patchTarget = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).send({
        statusCode: 400,
        message: 'Bad request',
      });
    }

    if (!req.params.target === 'version' && !req.params.target === 'firstStart') {
      return res.status(400).send({
        statusCode: 400,
        message: `Please change "${req.params.target}" directly via the respective API`,
      });
    }

    const result = await ConfigModel.getByTarget(req.params.target);

    if (!result) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Target not found',
      });
    }

    await ConfigModel.patchByTarget(req.params.target, req.body);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
