'use-strict';

const { Database } = require('../../database');

exports.show = async () => {
  return await Database.interfaceDB.get('settings').value();
};

exports.getByTarget = async (target) => {
  return await Database.interfaceDB.get('settings').get(target).value();
};

exports.patchByTarget = async (target, settingsData) => {
  await Database.interfaceDB.read();

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
      cameraSettings.rekognition.labels = cameraSettings.rekognition.labels.split(',').map((value) => value.trim());

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
};

exports.resetSettings = async () => {
  return await Database.resetDatabase();
};
