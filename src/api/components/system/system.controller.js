/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

exports.restartSystem = async (req, res) => {
  try {
    console.log('Restart was initiated');
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
    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
