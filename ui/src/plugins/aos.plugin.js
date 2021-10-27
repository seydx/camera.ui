/* eslint-disable no-unused-vars */
import Vue from 'vue';
import AOS from 'aos';
import 'aos/dist/aos.css';

export default {
  install(Vue) {
    AOS.init({
      offset: 0,
    });

    Vue.mixin({
      updated() {
        this.$nextTick(function () {
          AOS.refreshHard();
        });
      },
    });
  },
};
