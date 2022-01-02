/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const CamerasModel = require('./cameras.model');

const { CameraController } = require('../../../controller/camera/camera.controller');
const { MotionController } = require('../../../controller/motion/motion.controller');

const setTimeoutAsync = (ms) => new Promise((res) => setTimeout(res, ms));

exports.insert = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.body.name);

    if (camera) {
      return res.status(409).send({
        statusCode: 409,
        message: 'Camera already exists',
      });
    }

    const result = await CamerasModel.createCamera(req.body);

    res.status(201).send({
      name: result.name,
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.list = async (req, res, next) => {
  try {
    res.locals.items = await CamerasModel.list();

    return next();
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.getByName = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    res.status(200).send(camera);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.patchByName = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).send({
        statusCode: 400,
        message: 'Bad request',
      });
    }

    let camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    if (req.body.name && req.params.name !== req.body.name) {
      camera = await CamerasModel.findByName(req.body.name);

      if (camera) {
        return res.status(422).send({
          statusCode: 422,
          message: 'Camera already exists',
        });
      }
    }

    await CamerasModel.patchCamera(req.params.name, req.body);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.getStatusByName = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const status = await CamerasModel.pingCamera(camera, req.query.timeout);

    res.status(200).send({
      status: status ? 'ONLINE' : 'OFFLINE',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.getCameraSettingsByName = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const cameraSetting = await CamerasModel.getSettingsByName(req.params.name);

    if (!cameraSetting) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera setting not found',
      });
    }

    res.status(200).send(cameraSetting);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.getSnapshotByName = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const imageBuffer = await CamerasModel.requestSnapshot(camera);

    if (req.query.buffer) {
      res.status(200).send(imageBuffer.toString('base64'));
    } else {
      res.set('Content-Type', 'image/jpeg');
      res.set('Content-Disposition', 'inline');
      res.status(200).send(imageBuffer);
    }
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.removeByName = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    await CamerasModel.removeByName(req.params.name);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.removeAll = async (req, res) => {
  try {
    await CamerasModel.removeAll();

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.resetMotion = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    MotionController.triggerMotion(camera.name, false);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.restartPrebuffering = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const controller = CameraController.cameras.get(req.params.name);

    if (!controller || (controller && !controller.prebuffer)) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera controller not exists',
      });
    }

    controller.prebuffer.restart(true);
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.startMotion = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    MotionController.triggerMotion(camera.name, true);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.stopPrebuffering = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const controller = CameraController.cameras.get(req.params.name);

    if (!controller || (controller && !controller.prebuffer)) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera controller not exists',
      });
    }

    controller.prebuffer.stop(true);
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
