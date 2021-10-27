import api from './index';

const resource = '/config';

const getConfig = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

export { getConfig };
