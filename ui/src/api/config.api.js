import api from './index';

const resource = '/config';

const changeConfig = async (configData, parameters) =>
  await api.patch(`${resource}${parameters ? parameters : ''}`, configData);

const getConfig = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

export { changeConfig, getConfig };
