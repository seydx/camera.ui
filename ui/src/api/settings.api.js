import api from './index';

const resource = '/settings';
const reset_resource = 'reset';

const changeSetting = async (target, targetData, parameters) =>
  await api.patch(`${resource}/${target}${parameters ? parameters : ''}`, targetData);

const getSettings = async () => await api.get(resource);

const getSetting = async (target, parameters) => await api.get(`${resource}/${target}${parameters ? parameters : ''}`);

const resetSettings = async () => await api.put(`${resource}/${reset_resource}`);

export { changeSetting, getSetting, getSettings, resetSettings };
