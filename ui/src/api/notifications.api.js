import api from './index';

const resource = '/notifications';

export const addNotification = async (notificationData) => await api.post(resource, notificationData);

export const getNotification = async (notificationId) => await api.get(`${resource}/${notificationId}`);

export const getNotifications = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

export const removeNotification = async (notificationId) => await api.delete(`${resource}/${notificationId}/`);

export const removeNotifications = async () => await api.delete(resource);
