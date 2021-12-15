import api from './index';

const resource = '/system';
const changelog_resource = 'changelog';
const db_resource = 'db';
const db_download_resource = 'db/download';
const log_resource = 'log';
const log_download_resource = 'log/download';
const npm_resource = 'npm';
const restart_resource = 'restart';
const update_resource = 'update';

const downloadDb = async () => await api.get(`${resource}/${db_download_resource}`);

const downloadLog = async () => await api.get(`${resource}/${log_download_resource}`);

const getChangelog = async (parameters) =>
  await api.get(`${resource}/${changelog_resource}${parameters ? parameters : ''}`);

const getDb = async () => await api.get(`${resource}/${db_resource}`);

const getLog = async () => await api.get(`${resource}/${log_resource}`);

const getPackage = async () => await api.get(`${resource}/${npm_resource}`);

const removeLog = async () => await api.delete(`${resource}/${log_resource}`);

const restartSystem = async () => await api.put(`${resource}/${restart_resource}`);

const updateSystem = async (parameters) =>
  await api.put(`${resource}/${update_resource}${parameters ? parameters : ''}`);

export { downloadDb, downloadLog, getChangelog, getDb, getLog, getPackage, removeLog, restartSystem, updateSystem };
