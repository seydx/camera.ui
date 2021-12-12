'use-strict';

const { Database } = require('../../database');

exports.show = async (all) => {
  await Database.interfaceDB.read();

  // eslint-disable-next-line unicorn/prefer-ternary
  if (all) {
    return await Database.interfaceDB.value();
  } else {
    return await Database.interfaceDB.get('settings').value();
  }
};

exports.getByTarget = async (all, target) => {
  await Database.interfaceDB.read();

  // eslint-disable-next-line unicorn/prefer-ternary
  if (all) {
    return await Database.interfaceDB.get(target).value();
  } else {
    return await Database.interfaceDB.get('settings').get(target).value();
  }
};

exports.patchByTarget = async (all, target, settingsData) => {
  await Database.interfaceDB.read();

  if (all) {
    let settings = await Database.interfaceDB.value();

    for (const [key, value] of Object.entries(settingsData)) {
      if (settings[key] !== undefined) {
        settings[key] = value;
      }
    }

    return await Database.interfaceDB.get(target).assign(settings).write();
  } else {
    const settings = await Database.interfaceDB.get('settings').get(target).value();

    if (target === 'aws') {
      settingsData.contingent_total = Number.parseInt(settingsData.contingent_total) || settings.contingent_total;

      if (settings.contingent_total !== settingsData.contingent_total) {
        const oldContingentDif = settings.contingent_total - settings.contingent_left;
        settingsData.contingent_left = settingsData.contingent_total - oldContingentDif;
      }
    }

    if (target === 'cameras') {
      for (const cameraSettings of settingsData) {
        cameraSettings.rekognition.confidence = Number.parseInt(cameraSettings.rekognition.confidence);

        cameraSettings.rekognition.labels = cameraSettings.rekognition.labels.toString();
        cameraSettings.rekognition.labels = cameraSettings.rekognition.labels
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value);

        cameraSettings.pingTimeout =
          (Number.parseInt(cameraSettings.pingTimeout) || 0) < 1 ? 1 : Number.parseInt(cameraSettings.pingTimeout);
      }
    }

    for (const [key, value] of Object.entries(settingsData)) {
      if (settings[key] !== undefined) {
        settings[key] = value;
      }
    }

    return await Database.interfaceDB.get('settings').get(target).assign(settings).write();
  }
};

exports.resetSettings = async () => {
  return await Database.resetDatabase();
};
