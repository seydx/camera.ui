import Vue from 'vue';
import Vuex from 'vuex';

import { auth } from './auth';
import { camview } from './camview';
import { config } from './config';
import { dashboard } from './dashboard';
import { notifications } from './notifications';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {},
  mutations: {},
  actions: {},
  modules: {
    auth,
    camview,
    config,
    dashboard,
    notifications,
  },
});
