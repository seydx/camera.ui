/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { ConfigService } = require('../../../services/config/config.service');

const { Socket } = require('../../socket');

const AuthModel = require('./auth.model');

const jwtSecret = ConfigService.interface.jwt_secret;

exports.check = (req, res) => {
  try {
    res.status(200).send({
      status: 'OK',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    let sessionTimer = req.body.sessionTimer || 14400;
    let salt = crypto.randomBytes(16).toString('base64');

    req.body.salt = salt;

    let token = jwt.sign(req.body, jwtSecret, { expiresIn: sessionTimer });

    AuthModel.insert(token);

    if (sessionTimer / 3600 <= 25) {
      setTimeout(() => {
        AuthModel.invalidateByToken(token);
        Socket.io.emit('invalidToken', token);
      }, (sessionTimer - 5) * 1000);
    }

    res.status(201).send({
      access_token: token,
      token_type: 'Bearer',
      expires_in: sessionTimer,
      expires_at: new Date((Date.now() / 1000 + sessionTimer) * 1000),
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.logout = async (req, res) => {
  try {
    let authHeader = req.headers['authorization'] || req.headers['Authorization'];
    let authorization = authHeader ? req.headers['authorization'].split(/\s+/) : false;

    let token = authorization && authorization[0] === 'Bearer' ? authorization[1] : false;

    if (token) {
      AuthModel.invalidateByToken(token);
    }

    /* Using this would accidentally revoke a token from another device (from same user)
    let userName = req.jwt
      ? req.jwt.username
      : false;

    if(userName){
      AuthModel.invalidateByName(userName);
    }*/

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.logoutAll = async (req, res) => {
  try {
    AuthModel.invalidateAll();
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
