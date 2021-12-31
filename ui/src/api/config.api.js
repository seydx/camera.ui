import api from './index';

const resource = '/config';

export const changeConfig = async (configData, parameters) =>
  await api.patch(`${resource}${parameters ? parameters : ''}`, configData);

export const getConfig = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);
