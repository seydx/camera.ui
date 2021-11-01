import api from './index';

const resource = '/system';
const restart_resource = 'restart';
const update_resource = 'update';

const restartSystem = async () => await api.get(`${resource}/${restart_resource}`);

const updateSystem = async () => await api.get(`${resource}/${update_resource}`);

export { restartSystem, updateSystem };
