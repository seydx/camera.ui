import api from './index';

const resource = '/auth';
const login_resource = 'login';
const logout_resource = 'logout';
const check_resource = 'check';

export const checkLogin = async () => await api.get(`${resource}/${check_resource}`);

export const login = async (userData) => await api.post(`${resource}/${login_resource}`, userData);

export const logout = async () => await api.post(`${resource}/${logout_resource}`);
