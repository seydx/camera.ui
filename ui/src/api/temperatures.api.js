import api from './index';

const resource = '/temperatures';

export const addTemperature = async (notificationData) => await api.post(resource, notificationData);

export const getTemperatures = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

export const removeTemperatures = async () => await api.delete(resource);
