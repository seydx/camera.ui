import api from './index';

const resource = '/auth';
const login_resource = 'login';
const logout_resource = 'logout';
const check_resource = 'check';

const checkLogin = async () => await api.get(`${resource}/${check_resource}`);

const login = async (userData) => await api.post(`${resource}/${login_resource}`, userData);

const logout = async () => await api.post(`${resource}/${logout_resource}`);

export { checkLogin, login, logout };
