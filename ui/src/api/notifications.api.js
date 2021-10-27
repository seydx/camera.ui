import api from './index';

const resource = '/notifications';

const addNotification = async (notificationData) => await api.post(resource, notificationData);

const getNotification = async (notificationId) => await api.get(`${resource}/${notificationId}`);

const getNotifications = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

const removeNotification = async (notificationId) => await api.delete(`${resource}/${notificationId}/`);

const removeNotifications = async () => await api.delete(resource);

export { addNotification, getNotification, getNotifications, removeNotification, removeNotifications };
