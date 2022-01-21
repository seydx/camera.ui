/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import ConfigService from '../../../services/config/config.service.js';

import Database from '../../database.js';
import Socket from '../../socket.js';

import * as AuthModel from './auth.model.js';

const jwtSecret = ConfigService.interface.jwt_secret;

export const check = (req, res) => {
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

export const login = async (req, res) => {
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

export const logout = async (req, res) => {
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

    await Database.interfaceDB.write();

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const logoutAll = async (req, res) => {
  try {
    AuthModel.invalidateAll();
    await Database.interfaceDB.write();
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
