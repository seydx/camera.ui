<template lang="pug">
  #app(v-if="$route.meta.name === 'login' || $route.meta.name === 'start' || $route.meta.name === 'notfound' || currentUser")
    button.add-button(v-if="$route.meta.name !== 'login' && $route.meta.name !== 'start'", style="display: none;") {{ $t('add_to_homescreen') }}
    audio#soundFx(v-if="$route.meta.name !== 'login'")
      source(src="@/assets/sounds/notification.mp3" type="audio/mpeg")
    back-to-top(v-if="$route.meta.showBackTop" bottom="45px" right="30px" visibleoffset="100")
      .back-to-top.text-center
        b-icon(icon="arrow-up-short", aria-hidden="true", style="vertical-align: -.2em !important")
    Navbar(:name="$route.params.name || $t($route.meta.parentName || $route.meta.name)", v-if="$route.meta.showNavi")
    transition(name='fade' mode='out-in')
      router-view
    Footer(v-if="$route.meta.showFooter")
  #app(v-else)
    #preloader2
</template>

<script>
import BackToTop from 'vue-backtotop';
import { BIcon, BIconArrowUpShort } from 'bootstrap-vue';

import Navbar from '@/components/navbar.vue';
import Footer from '@/components/footer.vue';
import update from '@/mixins/update.mixin';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  components: {
    BackToTop,
    BIcon,
    BIconArrowUpShort,
    Navbar,
    Footer,
  },
  mixins: [update],
  computed: {
    currentUser() {
      return this.$store.state.auth.user;
    },
    uiConfig() {
      return this.$store.state.config.ui;
    },
  },
  async mounted() {
    const preloader = document.querySelector('#preloader');

    if (preloader) {
      preloader.classList.add('preloader-hide');
      await timeout(200);
      preloader.remove();
    }
  },
  methods: {
    closeHandler() {
      this.index = null;
      this.$toast.dismiss(this.id);
      this.id = '';
    },
  },
};
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition-duration: 0.1s;
  transition-property: all;
  transition-timing-function: ease-in-out;
  transition-delay: 0;
}

.fade-enter,
.fade-leave-active {
  opacity: 0;
}

.footer-offset {
  margin-bottom: calc(env(safe-area-inset-bottom, -100px) + 100px) !important;
}

.offline-icon {
  position: absolute;
  left: 50%;
  top: 50%;
  -webkit-transform: translate(-50%, -50%);
  -ms-transform: translate(-50%, -50%);
  transform: translate(-50%, -50%);
  font-size: 30px;
  color: #c4c4c4;
}

.Vue-Toastification__toast {
  margin-bottom: calc(env(safe-area-inset-top, -5px) + 5px) !important;
}

.page-link {
  color: var(--primary-color) !important;
}

.page-item.active .page-link {
  z-index: 0 !important;
  color: #fff !important;
  background-color: var(--primary-color) !important;
  border-color: var(--secondary-color) !important;
}

.page-link:hover {
  color: var(--primary-color) !important;
}

.page-link:focus {
  box-shadow: none !important;
}

.infinite-status-prompt {
  color: var(--secondary-font-color) !important;
}

@media only screen and (max-width: 600px) {
  .Vue-Toastification__container .Vue-Toastification__toast {
    width: 80% !important;
    margin: 0 auto !important;
    margin-bottom: env(safe-area-inset-bottom) !important;
  }
}

.back-to-top {
  width: 30px;
  height: 30px;
  background: var(--primary-color);
  border-radius: 15px;
  color: #ffffff !important;
  border: 2px solid rgba(0, 0, 0, 0.2);
  cursor: pointer;
  opacity: 0.8;
  transition: 0.3s all;
}

.back-to-top:hover {
  opacity: 1;
}
</style>
