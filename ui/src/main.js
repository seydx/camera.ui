import Vue from 'vue';
import App from '@/App.vue';
import router from '@/router';
import store from '@/store';
import '@/registerServiceWorker';

import '@/assets/css/theme.css';
import '@/assets/css/preloader.css';
import '@/assets/css/main.css';

import permission from '@/mixins/permission.mixin';

import AOS from '@/plugins/aos.plugin';
import { i18n } from '@/i18n';

import {
  ButtonPlugin,
  CardPlugin,
  CollapsePlugin,
  FormFilePlugin,
  FormInputPlugin,
  FormPlugin,
  FormSelectPlugin,
  FormTimepickerPlugin,
  InputGroupPlugin,
  LinkPlugin,
  ModalPlugin,
  OverlayPlugin,
  NavbarPlugin,
  PopoverPlugin,
  SpinnerPlugin,
} from 'bootstrap-vue';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';

import Toast from 'vue-toastification';
import ToastOptions from '@/common/toast.defaults.js';
import 'vue-toastification/dist/index.css';

import VueSocketIOExt from 'vue-socket.io-extended';
import socket from '@/common/socket-instance';

Vue.mixin(permission);

Vue.use(AOS);
Vue.use(ButtonPlugin);
Vue.use(CardPlugin);
Vue.use(CollapsePlugin);
Vue.use(FormFilePlugin);
Vue.use(FormInputPlugin);
Vue.use(FormPlugin);
Vue.use(FormSelectPlugin);
Vue.use(FormTimepickerPlugin);
Vue.use(InputGroupPlugin);
Vue.use(LinkPlugin);
Vue.use(ModalPlugin);
Vue.use(OverlayPlugin);
Vue.use(NavbarPlugin);
Vue.use(PopoverPlugin);
Vue.use(SpinnerPlugin);
Vue.use(Toast, ToastOptions);
Vue.use(VueSocketIOExt, socket, { store });

Vue.config.productionTip = false;

const app = new Vue({
  router,
  store,
  i18n: i18n,
  render: (h) => h(App),
}).$mount('#app');

export default app;
