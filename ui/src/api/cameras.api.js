import api from './index';

const resource = '/cameras';
const prebuffering_restart_resource = 'prebuffering/restart';
const prebuffering_stop_resource = 'prebuffering/stop';
const settings_resource = 'settings';
const snapshot_resource = 'snapshot';
const status_resource = 'status';

const addCamera = async (cameraData) => await api.post(resource, cameraData);

const changeCamera = async (cameraName, cameraData) => await api.patch(`${resource}/${cameraName}`, cameraData);

const getCamera = async (cameraName) => await api.get(`${resource}/${cameraName}`);

const getCameras = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

const getCameraSettings = async (cameraName) => await api.get(`${resource}/${cameraName}/${settings_resource}`);

const getCameraSnapshot = async (cameraName, parameters) =>
  await api.get(`${resource}/${cameraName}/${snapshot_resource}${parameters ? parameters : ''}`);

const getCameraStatus = async (cameraName, timeout) =>
  await api.get(`${resource}/${cameraName}/${status_resource}?timeout=${timeout || 1}`);

const removeCamera = async (cameraName) => await api.delete(`${resource}/${cameraName}/`);

const removeCameras = async () => await api.delete(resource);

const restartPrebuffering = async (cameraName) =>
  await api.put(`${resource}/${cameraName}/${prebuffering_restart_resource}`);

const stopPrebuffering = async (cameraName) => await api.put(`${resource}/${cameraName}/${prebuffering_stop_resource}`);

export {
  addCamera,
  changeCamera,
  getCamera,
  getCameras,
  getCameraSettings,
  getCameraSnapshot,
  getCameraStatus,
  removeCamera,
  removeCameras,
  restartPrebuffering,
  stopPrebuffering,
};
