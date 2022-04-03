'use-strict';

import Database from '../../database.js';

export const show = async (all) => {
  // eslint-disable-next-line unicorn/prefer-ternary
  if (all) {
    return await Database.interfaceDB.chain.cloneDeep().value();
  } else {
    return await Database.interfaceDB.chain.get('settings').value();
  }
};

export const getByTarget = async (all, target) => {
  // eslint-disable-next-line unicorn/prefer-ternary
  if (all) {
    return await Database.interfaceDB.chain.get(target).cloneDeep().value();
  } else {
    return await Database.interfaceDB.chain.get('settings').get(target).cloneDeep().value();
  }
};

export const patchByTarget = async (all, target, settingsData) => {
  if (all) {
    let settings = await Database.interfaceDB.chain.cloneDeep().value();

    for (const [key, value] of Object.entries(settingsData)) {
      if (settings[key] !== undefined) {
        settings[key] = value;
      }
    }

    return await Database.interfaceDB.chain.assign(settings).value();
  } else {
    const settings = await Database.interfaceDB.chain.get('settings').get(target).cloneDeep().value();

    if (target === 'aws') {
      settingsData.contingent_total = Number.parseInt(settingsData.contingent_total) || settings.contingent_total;

      if (settings.contingent_total !== settingsData.contingent_total) {
        const oldContingentDif = settings.contingent_total - settings.contingent_left;
        settingsData.contingent_left = settingsData.contingent_total - oldContingentDif;
      }
    }

    if (target === 'cameras') {
      for (const cameraSettings of settingsData) {
        if (cameraSettings.rekognition) {
          cameraSettings.rekognition.confidence = Number.parseInt(cameraSettings.rekognition.confidence);
          cameraSettings.rekognition.labels = cameraSettings.rekognition.labels.toString();
          cameraSettings.rekognition.labels = cameraSettings.rekognition.labels
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        }

        cameraSettings.pingTimeout =
          (Number.parseInt(cameraSettings.pingTimeout) || 0) < 1 ? 1 : Number.parseInt(cameraSettings.pingTimeout);
      }
    }

    for (const [key, value] of Object.entries(settingsData)) {
      if (settings[key] !== undefined) {
        settings[key] = value;
      }
    }

    return await Database.interfaceDB.chain.get('settings').get(target).assign(settings).value();
  }
};

export const resetSettings = async () => {
  return await Database.resetDatabase();
};
