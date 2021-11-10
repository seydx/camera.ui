import api from './index';

const resource = '/system';
const changelog_resource = 'changelog';
const log_resource = 'log';
const log_download_resource = 'log/download';
const npm_resource = 'npm';
const restart_resource = 'restart';
const update_resource = 'update';

const downloadLog = async () => await api.get(`${resource}/${log_download_resource}`);

const getChangelog = async (parameters) =>
  await api.get(`${resource}/${changelog_resource}${parameters ? parameters : ''}`);

const getLog = async () => await api.get(`${resource}/${log_resource}`);

const getPackage = async () => await api.get(`${resource}/${npm_resource}`);

const restartSystem = async () => await api.put(`${resource}/${restart_resource}`);

const updateSystem = async (parameters) =>
  await api.put(`${resource}/${update_resource}${parameters ? parameters : ''}`);

export { downloadLog, getChangelog, getLog, getPackage, restartSystem, updateSystem };
