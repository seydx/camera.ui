import api from './index';

const resource = '/config';
const config_download_resource = 'download';
const config_stat_resource = 'stat';

export const changeConfig = async (configData, parameters) =>
  await api.patch(`${resource}${parameters ? parameters : ''}`, configData);

export const downloadConfig = async () => await api.get(`${resource}/${config_download_resource}`);

export const getConfig = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

export const getConfigStat = async () => await api.get(`${resource}/${config_stat_resource}`);
