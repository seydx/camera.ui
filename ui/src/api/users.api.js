import api from './index';

const resource = '/users';

const addUser = async (userData) => await api.post(resource, userData);

const changeUser = async (userName, userData) => await api.patch(`${resource}/${userName}`, userData);

const getUser = async (userName) => await api.get(`${resource}/${userName}`);

const getUsers = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

const removeUser = async (userName) => await api.delete(`${resource}/${userName}`);

export { addUser, changeUser, removeUser, getUser, getUsers };
