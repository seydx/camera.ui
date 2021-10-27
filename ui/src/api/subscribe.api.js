import api from './index';

const resource = '/subscribe';

const getKeys = async () => await api.get(resource);

const subscribe = async (subscribeData) => await api.post(resource, subscribeData);

export { getKeys, subscribe };
