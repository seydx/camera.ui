import Vue from 'vue';
import Vuex from 'vuex';

import { auth } from './auth.module';
import { camview } from './camview.module';
import { config } from './config.module';
import { dashboard } from './dashboard.module';
import { notifications } from './notifications.module';

Vue.use(Vuex);

const store = new Vuex.Store({
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

export default store;
