import api from './index';

const resource = '/system';
const changelog_resource = 'changelog';
const npm_resource = 'npm';
const restart_resource = 'restart';
const update_resource = 'update';

const getPackage = async () => await api.get(`${resource}/${npm_resource}`);

const getChangelog = async (parameters) =>
  await api.get(`${resource}/${changelog_resource}${parameters ? parameters : ''}`);

const restartSystem = async () => await api.put(`${resource}/${restart_resource}`);

const updateSystem = async (parameters) =>
  await api.put(`${resource}/${update_resource}${parameters ? parameters : ''}`);

export { getChangelog, getPackage, restartSystem, updateSystem };
