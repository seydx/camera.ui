import api from './index';

const resource = '/config';

const changeTargetConfig = async (target, targetData, parameters) =>
  await api.patch(`${resource}/${target}${parameters ? parameters : ''}`, targetData);

const getConfig = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

const getTargetConfig = async (target, parameters) =>
  await api.get(`${resource}/${target}${parameters ? parameters : ''}`);

export { changeTargetConfig, getConfig, getTargetConfig };
