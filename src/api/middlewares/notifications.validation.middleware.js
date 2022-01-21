/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

export const hasValidFields = async (req, res, next) => {
  let errors = [];

  if (req.body) {
    if (!req.body.camera) {
      errors.push('Missing camera field');
    }

    if (!req.body.trigger) {
      errors.push('Missing trigger field');
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
