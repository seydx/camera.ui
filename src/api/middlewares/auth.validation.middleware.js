/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { ConfigService } = require('../../services/config/config.service');

const AuthModel = require('../components/auth/auth.model');
const UserModel = require('../components/users/users.model');

const jwtSecret = ConfigService.interface.jwt_secret;

const getBearerToken = async (username, password) => {
  if (username && username !== '' && password && password !== '') {
    const user = await UserModel.findByName(username);
    if (user) {
      let passwordFields = user.password.split('$');
      let salt = passwordFields[0];
      let hash = crypto.createHmac('sha512', salt).update(password).digest('base64');

      if (hash === passwordFields[1]) {
        const payload = {
          id: user.id,
          username: user.username,
          sessionTimer: user.sessionTimer,
          permissionLevel: user.permissionLevel,
          photo: user.photo,
        };

        let sessionTimer = payload.sessionTimer || 14400;
        payload.salt = crypto.randomBytes(16).toString('base64');

        return jwt.sign(payload, jwtSecret, { expiresIn: sessionTimer });
      }
    }
  }
};

exports.validJWTNeeded = async (req, res, next) => {
  let bypassValidation = false;

  if (req.query.username && req.query.password) {
    const authorization = await getBearerToken(req.query.username, req.query.password);
    if (authorization) {
      bypassValidation = true;
      req.headers['authorization'] = `Bearer ${authorization}`;
    }
  }
  if (req.headers['authorization'] || req.headers['Authorization']) {
    try {
      let authHeader = req.headers['authorization'] || req.headers['Authorization'];
      let authorization = authHeader.split(' ');

      if (authorization[0] !== 'Bearer') {
        return res.status(401).send({
          statusCode: 401,
          message: 'Unauthorized',
        });
      } else {
        //check if user/token exists in database and is still valid
        const user = AuthModel.findByToken(authorization[1]);

        if (!bypassValidation && (!user || (user && !user.valid))) {
          return res.status(401).send({
            statusCode: 401,
            message: 'Token expired',
          });
        }

        req.jwt = jwt.verify(authorization[1], jwtSecret);

        return next();
      }
    } catch (error) {
      return res.status(401).send({
        statusCode: 401,
        message: error,
      });
    }
  } else {
    return res.status(401).send({
      statusCode: 401,
      message: 'Unauthorized',
    });
  }
};

exports.validJWTOptional = async (req, res, next) => {
  if (req.query.username && req.query.password) {
    const authorization = await getBearerToken(req.query.username, req.query.password);
    if (authorization) {
      req.headers['authorization'] = `Bearer ${authorization}`;
    }
  }
  if (req.headers['authorization'] || req.headers['Authorization']) {
    try {
      let authHeader = req.headers['authorization'] || req.headers['Authorization'];
      let authorization = authHeader.split(' ');

      if (authorization[0] === 'Bearer') {
        //check if user/token exists in database and is still valid
        const user = AuthModel.findByToken(authorization[1]);

        if (!user || (user && user.valid)) {
          req.jwt = jwt.verify(authorization[1], jwtSecret);
        }
      }
    } catch {
      return next();
    }
  }

  return next();
};
