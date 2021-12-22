<template lang="pug">
.settings-navi.pl-safe.pr-safe.tw-flex.tw-flex-col.tw-h-full(key="settingsSidebar" :class="(showSidebar ? 'settings-navi-show ' : '') + (extendSidebar ? 'extended-sidebar' : '')" v-click-outside="{ handler: hideNavi, include: include }")
  .sidebar-nav-items.tw-p-3(v-for="point in navigation" v-if="checkLevel(point.requiredLevel)" :key="point.name" :class="$route.path === point.to || $route.meta.name === point.name ? 'sidebar-nav-items-active' : ''")
    v-btn.tw-m-3.tw-flex.tw-flex-col.tw-p-0.tw-justify-center.tw-items-start.sidebar-nav-item(type="div" @click="hideNavi" :to="point.to" active-class="sidebar-settings-nav-item-active" plain block tile :ripple="false")
      v-icon(height="24px" width="24px" :class="$route.path === point.to ? darkmode ? 'sidebar-nav-item-text-dark' : 'sidebar-nav-item-text-light' : 'text-muted'").tw-mr-4 {{ icons[point.icon] }}
      .tw-block(style="max-width: 240px")
        span.sidebar-nav-item-text(:class="$route.path === point.to ? darkmode ? 'sidebar-nav-item-text-dark' : 'sidebar-nav-item-text-light' : ''") {{ $t(point.name.toLowerCase()) }}
        .tw-block.text-muted {{ $t(`${point.name.toLowerCase()}_nav_info`) }}
</template>

<script>
import {
  mdiAccountCircleOutline,
  mdiAccountPlus,
  mdiApplicationCog,
  mdiBackupRestore,
  mdiBellOutline,
  mdiCctv,
  mdiFaceRecognition,
  mdiImageMultipleOutline,
  mdiPencilRuler,
  mdiTune,
} from '@mdi/js';

import { bus } from '@/main';
import { routes } from '@/router';

export default {
  name: 'SidebarSettings',

  data: () => ({
    icons: {
      'mdi-account-circle-outline': mdiAccountCircleOutline,
      'mdi-account-plus': mdiAccountPlus,
      'mdi-application-cog': mdiApplicationCog,
      'mdi-backup-restore': mdiBackupRestore,
      'mdi-bell-outline': mdiBellOutline,
      'mdi-cctv': mdiCctv,
      'mdi-face-recognition': mdiFaceRecognition,
      'mdi-image-multiple-outline': mdiImageMultipleOutline,
      'mdi-pencil-ruler': mdiPencilRuler,
      'mdi-tune': mdiTune,
    },
    navigation: routes
      .find((route) => route.name === 'Settings')
      .children.map((route) => {
        return {
          name: route.meta.name,
          to: `/settings/${route.path}`,
          ...route.meta.navigation,
          ...route.meta.auth,
        };
      })
      .filter((route) => route),
    extendSidebar: false,
    extendSidebarTimeout: null,
    showSidebar: false,
  }),

  computed: {
    darkmode() {
      return localStorage.getItem('theme') === 'dark';
    },
  },

  watch: {
    '$route.path': {
      handler() {
        if (this.showSidebar) {
          this.hideNavi();
        }
      },
    },
  },

  created() {
    bus.$on('showSettingsNavi', this.toggleSettingsNavi);
    bus.$on('extendSidebar', this.triggerSidebar);
  },

  mounted() {
    this.scrollNavi();
  },

  beforeDestroy() {
    bus.$off('showSettingsNavi', this.toggleSettingsNavi);
    bus.$off('extendSidebar', this.triggerSidebar);
  },

  methods: {
    include() {
      return [...document.querySelectorAll('.settings-included')];
    },
    hideNavi() {
      this.showSidebar = false;
      bus.$emit('showSettingsOverlay', false);
    },
    scrollNavi() {
      const activeNav = document.querySelector('.sidebar-settings-nav-item-active');
      const mainNavi = document.querySelector('.settings-navi');

      this.$vuetify.goTo(activeNav, {
        container: mainNavi,
        duration: 250,
        offset: 50,
        easing: 'easeInOutCubic',
      });
    },
    toggleSettingsNavi(state) {
      state = this.showSidebar ? !state : state;
      this.showSidebar = state;

      if (state) {
        this.scrollNavi();
      }
    },
    triggerSidebar(state) {
      this.extendSidebar = state;
    },
  },
};
</script>

<style scoped>
.settings-navi {
  background: rgba(var(--cui-bg-app-bar-rgb));
  position: fixed;
  overflow-y: scroll;
  overflow-x: hidden;
  top: calc(64px + env(safe-area-inset-top, 0px));
  bottom: 0;
  min-width: 0px;
  max-width: calc(320px + env(safe-area-inset-left, 0px));
  height: calc(100vh - 64px - env(safe-area-inset-top, 0px));
  min-height: calc(100vh - 64px - env(safe-area-inset-top, 0px));
  max-height: calc(100vh - 64px - env(safe-area-inset-top, 0px));
  transition: 0.3s all;
  z-index: 98;
  left: -600px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  width: calc(320px + env(safe-area-inset-left, 0px));
  box-shadow: 3px 0px 3px -2px rgb(0 0 0 / 25%), 3px 0px 4px 0px rgb(0 0 0 / 11%), 1px 0px 38px 0px rgb(0 0 0 / 5%) !important;
}

.settings-navi::-webkit-scrollbar {
  width: 0px;
  display: none;
}

.settings-navi-show {
  width: calc(320px + env(safe-area-inset-left, 0px));
  min-width: calc(320px + env(safe-area-inset-left, 0px));
  left: 77px;
}

.sidebar-nav-items {
  max-height: 300px !important;
  width: 320px !important;
  border-bottom: 1px solid rgba(var(--cui-text-default-rgb), 0.05) !important;
}

.sidebar-nav-items-active {
  background: rgba(var(--cui-text-default-rgb), 0.05) !important;
}

.sidebar-nav-items-bottom {
  margin-bottom: 44px;
}

.sidebar-nav-item {
  color: rgba(255, 255, 255, 0.6);
  height: auto !important;
  white-space: unset !important;
  letter-spacing: unset !important;
  text-transform: unset !important;
  font-weight: unset !important;
  text-indent: unset !important;
  color: rgba(var(--cui-text-default-rgb)) !important;
  opacity: 1 !important;
}

.sidebar-settings-nav-item-active,
.sidebar-nav-item:hover {
  color: rgba(255, 255, 255, 1);
}

.sidebar-nav-item-text {
  font-weight: 600 !important;
  font-size: 0.875rem !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  line-height: 1.8 !important;
}

.sidebar-nav-item-text-light {
  color: rgba(var(--cui-primary-rgb)) !important;
}

.sidebar-nav-item-text-dark {
  color: rgba(var(--cui-primary-500-rgb)) !important;
}

.siderbar-nav-divider {
  border-color: rgba(255, 255, 255, 0.06) !important;
}

.page-title {
  font-size: 1.5rem !important;
  letter-spacing: -0.025em !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
  margin-left: 0.5rem !important;
}

.subnavi-toggle {
  display: block;
}

.sidebar-nav-item >>> .v-btn__content {
  align-items: flex-start !important;
}

@media (max-width: 960px) {
  .settings-navi {
    /*position: fixed;*/
    left: -1000px;
  }
  .settings-navi-show {
    left: 0 !important;
  }
}

@media (min-width: 1280px) {
  .subnavi-toggle {
    display: none;
  }
  .extended-sidebar {
    left: 280px !important;
  }
  .settings-navi {
    width: calc(320px + env(safe-area-inset-left, 0px)) !important;
    min-width: calc(320px + env(safe-area-inset-left, 0px)) !important;
    left: 77px;
    border-right: 1px solid rgba(var(--cui-bg-settings-border-rgb)) !important;
    box-shadow: none !important;
  }
}
</style>
