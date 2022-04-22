<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .tw-flex.tw-relative.pl-safe.pr-safe
    
    Sidebar
  
    .overlay(v-if="showOverlay")
      
    .settings-content.settings-included.tw-w-full.tw-relative
      .tw-flex.tw-items-center
        v-btn.text-default.included.settings-nav-toggle(@click="toggleSettingsNavi" icon height="38px" width="38px")
          v-icon {{ icons['mdiMenu'] }}
        .page-title {{ $t($route.meta.name.toLowerCase()) }}
      transition(name='fade' mode='out-in')
        router-view.tw-px-2.tw-max-w-4xl

  LightBox(
    ref="lightboxBanner"
    :media="notImages"
    :showLightBox="false"
    :showThumbs="false"
    showCaption
    disableScroll
  )
              
</template>

<script>
import LightBox from 'vue-it-bigger';
import 'vue-it-bigger/dist/vue-it-bigger.min.css';
import { mdiMenu } from '@mdi/js';

import { bus } from '@/main';

import Sidebar from '@/components/sidebar-settings.vue';

import socket from '@/mixins/socket';

export default {
  name: 'Settings',

  components: {
    LightBox,
    Sidebar,
  },

  mixins: [socket],

  beforeRouteEnter(to, from, next) {
    if (to.fullPath === '/settings') {
      next('/settings/account');
    } else {
      next();
    }
  },

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  data: () => ({
    icons: {
      mdiMenu,
    },
    loading: false,
    showOverlay: false,
  }),

  watch: {
    '$route.path': {
      handler() {
        this.showOverlay = false;
      },
    },
  },

  created() {
    bus.$on('showSettingsOverlay', this.triggerSettingsOverlay);
  },

  beforeDestroy() {
    bus.$off('showSettingsOverlay', this.triggerSettingsOverlay);
  },

  methods: {
    triggerSettingsOverlay(state) {
      this.showOverlay = state;
    },
    toggleSettingsNavi() {
      this.showOverlay = true;
      bus.$emit('showSettingsNavi', true);
    },
  },
};
</script>

<style>
.page-title {
  font-size: 1.3rem !important;
  letter-spacing: -0.025em !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
  margin-left: 5px;
}

.page-subtitle {
  font-size: 1.1rem !important;
  font-weight: 600 !important;
}

.page-item-title {
  font-size: 1rem !important;
  font-weight: 600 !important;
}

.page-subtitle-info {
  font-size: 0.9rem !important;
  font-weight: 500 !important;
  color: var(--cui-text-hint);
}

.page-header-info {
  font-size: 0.8rem !important;
  font-weight: 500 !important;
  color: var(--cui-text-hint);
}

.form-input-label {
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 2;
}

.loader {
  top: calc(64px + env(safe-area-inset-top, 0px)) !important;
}

.input-info {
  font-size: 11px !important;
  color: var(--cui-text-hint) !important;
  max-width: 90%;
  margin-top: 4px;
}

.v-text-field__details {
  padding-left: 0px !important;
}
</style>

<style scoped>
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

.page-loading {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
}

.overlay {
  background-color: #000 !important;
  border-color: #000 !important;
  opacity: 0.6;
  z-index: 1;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  /*left: -1rem;
  right: -1.5rem;
  top: -1.5rem;
  bottom: -1.5rem;*/
}

@media (min-width: 1280px) {
  .overlay {
    display: none;
  }
  .settings-nav-toggle {
    display: none !important;
  }
  .settings-content {
    margin-left: 320px;
  }
}
</style>
