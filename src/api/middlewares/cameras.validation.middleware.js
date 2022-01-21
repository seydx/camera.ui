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
