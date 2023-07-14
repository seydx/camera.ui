/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

export const hasValidFields = async (req, res, next) => {
  let errors = [];

  if (req.body) {
    if (!req.body.name) {
      errors.push('Missing name field');
    }

    if (!req.body.videoConfig) {
      errors.push('Missing videoConfig field');
    } else {
      if (!req.body.videoConfig.source) {
        errors.push('Missing videoConfig.source field');
      }
    }

    return errors.length > 0
      ? res.status(422).send({
          statusCode: 422,
          message: errors.join(','),
        })
      : next();
  } else {
    return res.status(400).send({
      statusCode: 400,
      message: 'Bad request',
    });
  }
};

export const hasValidAlertFields = async (req, res, next) => {
  let errors = [];

  if (req.body) {
    if (!req.body.camera) {
      errors.push('Missing camera field');
    }

    if (!req.body.image) {
      errors.push('Missing image');
    }

    if (!req.body.messageID) {
      errors.push('Missing Buzz messageID');
    }

    if (!req.body.time) {
      errors.push('Missing time');
    }

    if (!req.body.timestamp) {
      errors.push('Missing timestamp');
    }

    if (!req.body.site) {
      errors.push('Missing site');
    }

    if (!req.body.severity) {
      errors.push('Missing severity');
    }

    if (!req.body.object) {
      errors.push('Missing alert object field');
    } else {
      if (!req.body.object.info) {
        errors.push('Missing alert object info field');
      }
    }

    return errors.length > 0
      ? res.status(422).send({
          statusCode: 422,
          message: errors.join(','),
        })
      : next();
  } else {
    return res.status(400).send({
      statusCode: 400,
      message: 'Bad request, Missing alert request body',
    });
  }
};
