/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const ConfigModel = require('./config.model');

exports.show = async (req, res) => {
  try {
    const result = ConfigModel.show(req.jwt, req.query.target);

    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
