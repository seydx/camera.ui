/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

export const minimumPermissionLevelRequired = (required_permission_level) => {
  return (req, res, next) => {
    if (typeof required_permission_level === 'string') {
      required_permission_level = [required_permission_level];
    }

    const user_permission_level = req.jwt.permissionLevel || [];

    return user_permission_level.some((level) => required_permission_level.includes(level)) ||
      user_permission_level.includes('admin')
      ? next()
      : res.status(403).send({
          statusCode: 403,
          message: 'Forbidden',
        });
  };
};

export const onlySameUserOrAdminCanDoThisAction = (req, res, next) => {
  let user_permission_level = req.jwt.permissionLevel || [];
  let userName = req.jwt.username;

  if (req.params && req.params.name && userName === req.params.name) {
    return next();
  } else {
    return user_permission_level.includes('users:edit') || user_permission_level.includes('admin')
      ? next()
      : res.status(403).send({
          statusCode: 403,
          message: 'Forbidden',
        });
  }
};

export const onlySameUserOrMasterCanDoThisAction = (req, res, next) => {
  let user_permission_level = req.jwt.permissionLevel || [];
  let userName = req.jwt.name;

  if (req.params && req.params.name && userName === req.params.name) {
    return next();
  } else {
    return user_permission_level.includes('admin')
      ? next()
      : res.status(403).send({
          statusCode: 403,
          message: 'Forbidden',
        });
  }
};

export const onlyMasterCanDoThisAction = (req, res, next) => {
  let user_permission_level = req.jwt.permissionLevel || [];

  return user_permission_level.includes('admin')
    ? next()
    : res.status(403).send({
        statusCode: 403,
        message: 'Forbidden',
      });
};

export const masterCantDoThisAction = (req, res, next) => {
  let user_permission_level = req.jwt.permissionLevel || [];

  return !user_permission_level.includes('admin')
    ? next()
    : res.status(403).send({
        statusCode: 403,
        message: 'Forbidden',
      });
};

export const sameUserCantDoThisAction = (req, res, next) => {
  let userName = req.jwt.username;

  return req.params.name !== userName
    ? next()
    : res.status(403).send({
        statusCode: 403,
        message: 'Forbidden',
      });
};
