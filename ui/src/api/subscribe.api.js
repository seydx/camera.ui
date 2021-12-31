import api from './index';

const resource = '/subscribe';

export const getKeys = async () => await api.get(resource);

export const subscribe = async (subscribeData) => await api.post(resource, subscribeData);
