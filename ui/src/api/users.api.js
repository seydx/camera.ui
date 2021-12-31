import api from './index';

const resource = '/users';

export const addUser = async (userData) => await api.post(resource, userData);

export const changeUser = async (userName, userData) => await api.patch(`${resource}/${userName}`, userData);

export const getUser = async (userName) => await api.get(`${resource}/${userName}`);

export const getUsers = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

export const removeUser = async (userName) => await api.delete(`${resource}/${userName}`);
