import api from './index';

const resource = '/settings';
const reset_resource = 'reset';

export const changeSetting = async (target, targetData, parameters) =>
  await api.patch(`${resource}/${target}${parameters ? parameters : ''}`, targetData);

export const getSettings = async () => await api.get(resource);

export const getSetting = async (target, parameters) =>
  await api.get(`${resource}/${target}${parameters ? parameters : ''}`);

export const resetSettings = async () => await api.put(`${resource}/${reset_resource}`);
