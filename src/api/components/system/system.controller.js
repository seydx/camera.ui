/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const { Database } = require('../../database');

//TODO
exports.restartSystem = async (req, res) => {
  try {
    console.log('Restart was initiated');
    Database.controller.emit('restart');
    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.updateSystem = async (req, res) => {
  try {
    console.log('Update was initiated');
    Database.controller.emit('update');
    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
