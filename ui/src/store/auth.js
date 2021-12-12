import { login, logout } from '@/api/auth.api';
import socket from '@/common/socket-instance';
import SerializeService from '@/common/serialize-token';

const user = JSON.parse(localStorage.getItem('user'));
const userImg = localStorage.getItem('userImg');
const serializedUser = SerializeService.serialize(user);

const initialState = user
  ? {
      status: { loggedIn: true },
      user: {
        ...serializedUser,
        photo: userImg ? userImg : serializedUser.photo,
      },
    }
  : { status: { loggedIn: false }, user: null };

const unsubscribeUser = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((subscription) => {
        if (subscription) {
          subscription.unsubscribe();
        }
      });
    });
  }
};

export const auth = {
  namespaced: true,
  state: initialState,
  actions: {
    async login({ commit }, user) {
      try {
        const response = await login(user);
        commit('loginSuccess', response.data);
        return Promise.resolve();
      } catch (error) {
        commit('loginFailure');
        return Promise.reject(error);
      }
    },
    async logout({ commit }) {
      try {
        await logout();
      } catch (err) {
        console.log(err);
      }
      commit('logout');
      return Promise.resolve();
    },
    updateUserImg({ commit }, imgPath) {
      commit('updateImg', imgPath);
    },
  },
  mutations: {
    loginSuccess(state, user) {
      localStorage.setItem('user', JSON.stringify(user));
      state.status.loggedIn = true;
      state.user = SerializeService.serialize(user);
    },
    loginFailure(state) {
      localStorage.removeItem('user');
      localStorage.removeItem('userImg');
      localStorage.removeItem('lastPage');
      state.status.loggedIn = false;
      state.user = null;

      socket.close();
      unsubscribeUser();
    },
    logout(state) {
      localStorage.removeItem('user');
      localStorage.removeItem('userImg');
      localStorage.removeItem('lastPage');
      state.status.loggedIn = false;
      state.user = null;

      socket.close();
      unsubscribeUser();
    },
    updateImg(state, imgPath) {
      localStorage.setItem('userImg', imgPath);
      state.user.photo = imgPath;
    },
  },
  getters: {
    loggedIn: (state) => {
      return state.status.loggedIn;
    },
    user: (state) => {
      return state.user;
    },
  },
};
