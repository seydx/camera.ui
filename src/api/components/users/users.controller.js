/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import crypto from 'crypto';
import multer from 'multer';

import ConfigService from '../../../services/config/config.service.js';

import * as UserModel from './users.model.js';

export const insert = async (req, res) => {
  try {
    const userExist = await UserModel.findByName(req.body.username);

    if (userExist) {
      return res.status(409).send({
        statusCode: 409,
        message: 'User already exists',
      });
    }

    const users = await UserModel.list();

    if (users.some((usr) => usr.permissionLevel.includes('admin')) && req.body.permissionLevel.includes('admin')) {
      return res.status(409).send({
        statusCode: 409,
        message: 'User with ADMIN permission level already exists',
      });
    }

    let salt = crypto.randomBytes(16).toString('base64');
    let hash = crypto.createHmac('sha512', salt).update(req.body.password).digest('base64');

    req.body.password = salt + '$' + hash;

    await UserModel.createUser(req.body);

    res.status(201).send({
      username: req.body.username,
      permissionLevel: req.body.permissionLevel,
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const list = async (req, res, next) => {
  try {
    let result = await UserModel.list();

    for (const user of result) {
      delete user.password;
      //delete user.permissionLevel;
    }

    res.locals.items = result;

    return next();
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getByName = async (req, res) => {
  try {
    const user = await UserModel.findByName(req.params.name);

    if (!user) {
      return res.status(404).send({
        statusCode: 404,
        message: 'User not exists',
      });
    }

    delete user.password;

    res.status(200).send(user);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const patchByName = async (req, res) => {
  try {
    let user = await UserModel.findByName(req.params.name);

    if (!user) {
      return res.status(404).send({
        statusCode: 404,
        message: 'User not exists',
      });
    }

    const upload = multer({
      storage: multer.diskStorage({
        destination: (request_, file, callback) => {
          callback(null, ConfigService.databaseUserPath);
        },
        filename: (request_, file, callback) => {
          const fileName = `photo_${user.id}_${file.originalname}`;
          callback(null, fileName);
        },
      }),
    }).single('photo');

    upload(req, res, async (error) => {
      if (error) {
        res.status(500).send({
          statusCode: 500,
          message: error.message,
        });
      }

      if (req.file) {
        req.body.photo = req.file.filename;
      }

      if (req.body === undefined || Object.keys(req?.body).length === 0) {
        return res.status(400).send({
          statusCode: 400,
          message: 'Bad request',
        });
      }

      if (req.body.username && req.params.name !== req.body.username) {
        user = await UserModel.findByName(req.body.username);

        if (user) {
          return res.status(422).send({
            statusCode: 422,
            message: 'User already exists',
          });
        }
      }

      if (req.body.password) {
        let salt = crypto.randomBytes(16).toString('base64');
        let hash = crypto.createHmac('sha512', salt).update(req.body.password).digest('base64');
        req.body.password = salt + '$' + hash;
      }

      await UserModel.patchUser(req.params.name, req.body);

      res.status(204).send({});
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const removeByName = async (req, res) => {
  try {
    const user = await UserModel.findByName(req.params.name);

    if (!user) {
      return res.status(404).send({
        statusCode: 404,
        message: 'User not exists',
      });
    }

    if (user.permissionLevel.includes('admin')) {
      return res.status(409).send({
        statusCode: 409,
        message: 'User with ADMIN permission level can not be removed',
      });
    }

    await UserModel.removeByName(req.params.name);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
