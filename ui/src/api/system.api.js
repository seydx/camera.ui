import api from './index';

const resource = '/system';
const npm_resource = 'npm';
const restart_resource = 'restart';
const update_resource = 'update';

const getPackage = async () => await api.get(`${resource}/${npm_resource}`);

//TODO: PUT
const restartSystem = async () => await api.get(`${resource}/${restart_resource}`);

//TODO: PUT
const updateSystem = async (parameters) =>
  await api.get(`${resource}/${update_resource}${parameters ? parameters : ''}`);

export { getPackage, restartSystem, updateSystem };
