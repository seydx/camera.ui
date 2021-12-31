import api from './index';

const resource = '/cameras';
const prebuffering_restart_resource = 'prebuffering/restart';
const prebuffering_stop_resource = 'prebuffering/stop';
const settings_resource = 'settings';
const snapshot_resource = 'snapshot';
const status_resource = 'status';

export const addCamera = async (cameraData) => await api.post(resource, cameraData);

export const changeCamera = async (cameraName, cameraData) => await api.patch(`${resource}/${cameraName}`, cameraData);

export const getCamera = async (cameraName) => await api.get(`${resource}/${cameraName}`);

export const getCameras = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

export const getCameraSettings = async (cameraName) => await api.get(`${resource}/${cameraName}/${settings_resource}`);

export const getCameraSnapshot = async (cameraName, parameters) =>
  await api.get(`${resource}/${cameraName}/${snapshot_resource}${parameters ? parameters : ''}`);

export const getCameraStatus = async (cameraName, timeout) =>
  await api.get(`${resource}/${cameraName}/${status_resource}?timeout=${timeout || 1}`);

export const removeCamera = async (cameraName) => await api.delete(`${resource}/${cameraName}/`);

export const removeCameras = async () => await api.delete(resource);

export const restartPrebuffering = async (cameraName) =>
  await api.put(`${resource}/${cameraName}/${prebuffering_restart_resource}`);

export const stopPrebuffering = async (cameraName) =>
  await api.put(`${resource}/${cameraName}/${prebuffering_stop_resource}`);
