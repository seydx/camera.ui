<template lang="pug">
.tw-relative(style="z-index: 99")
  .top-navi-bar-minified(v-if="$route.meta.config.showMinifiedNavbar")
    v-btn.text-muted.included(@click="toggleNavi" fab elevation="1" height="38px" width="38px" color="rgba(0, 0, 0, 0.5)" retain-focus-on-click)
      v-icon {{ showSidebar ? icons['mdiArrowLeftThick'] : icons['mdiArrowRightThick'] }}
  v-app-bar.top-navi-bar.pt-safe(v-else height="64px" :class="($route.meta.config.fixedNavbar ? 'top-navi-bar-fixed ' : '') + (extendSidebar ? 'extended-sidebar' : '')" style="border-top: 1px solid rgba(121,121,121,0.1);")
    .navi-wrap.pl-safe.pr-safe
      v-btn.text-default.included(@click="toggleNavi" icon height="38px" width="38px")
        v-icon {{ icons['mdiMenu'] }}
      .tw-flex.tw-ml-auto(v-if="checkLevel('notifications:access')")
        v-badge(:value="notSize" :dot="notSize < 1" :content="notSize" color="var(--cui-primary)" offset-x="20" offset-y="20" bordered overlap)
          template(v-slot:badge)
            .badge-text.tw-flex.tw-justify-center.tw-items-center.tw-h-full.tw-w-full
              span(v-if="notSize > 99") 99+
              span(v-else) {{ notSize }}
          v-btn.text-default.tw-text-white.tw-mr-1(@click="$router.push('/notifications')" icon height="38px" width="38px")
            v-icon {{ icons['mdiBell'] }}

</template>

<script>
import { mdiArrowLeftThick, mdiArrowRightThick, mdiBell, mdiMenu } from '@mdi/js';

import { bus } from '@/main';

export default {
  name: 'Navbar',

  data: () => ({
    extendSidebar: false,
    icons: {
      mdiArrowLeftThick,
      mdiArrowRightThick,
      mdiBell,
      mdiMenu,
    },
    showSidebar: false,
    showNotificationsMenu: false,
    showProfileMenu: false,
  }),

  computed: {
    notSize() {
      return this.$store.state.notifications.size;
    },
  },

  created() {
    bus.$on('extendSidebar', this.triggerSidebar);
  },

  beforeDestroy() {
    bus.$off('extendSidebar', this.triggerSidebar);
  },

  methods: {
    triggerSidebar(state) {
      this.showSidebar = state;

      if (this.$route.meta.config.fixedNavbar) {
        this.extendSidebar = state;

        setTimeout(() => {
          this.scrollNavi();
        }, 300);
      } else {
        this.extendSidebar = false;
      }
    },
    toggleNavi() {
      bus.$emit('showSidebar', true);
      bus.$emit('showOverlay', true);

      setTimeout(() => {
        this.scrollNavi();
      }, 300);
    },
    scrollNavi() {
      const activeNav = document.querySelector('.sidebar-nav-item-active');
      const mainNavi = this.$route.meta.config.showMinifiedNavbar
        ? document.querySelector('.minified-navi')
        : document.querySelector('.main-navi');

      if (activeNav && mainNavi) {
        this.$vuetify.goTo(activeNav, {
          container: mainNavi,
          duration: 250,
          offset: 50,
          easing: 'easeInOutCubic',
        });
      }
    },
  },
};
</script>

<style scoped>
span >>> .v-badge__badge::after {
  border-color: rgba(var(--cui-bg-app-bar-rgb)) !important;
}

.navi-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.top-navi-bar-minified {
  position: absolute !important;
  height: calc(env(safe-area-inset-top, 0px) + 64px) !important;
  padding-top: calc(env(safe-area-inset-top, 0px) + 1rem) !important;
  padding-left: calc(env(safe-area-inset-left, 0px) + 1rem) !important;
}

.top-navi-bar {
  transition: 0.3s all;
  height: calc(env(safe-area-inset-top, 0px) + 64px) !important;
  background: rgba(var(--cui-bg-app-bar-rgb)) !important;
  box-shadow: 0px 3px 3px -2px rgb(0 0 0 / 15%), 0px 3px 4px 0px rgb(0 0 0 / 1%), 0px 1px 8px 0px rgb(0 0 0 / 1%) !important;
  border-bottom: 1px solid rgba(var(--cui-bg-app-bar-border-rgb)) !important;
}

.top-navi-bar-fixed {
  margin-left: 78px;
  position: fixed;
}

.notification-chip {
  color: rgba(var(--cui-text-default-rgb)) !important;
  background: rgba(var(--cui-bg-status-bar-rgb)) !important;
}

.extended-sidebar {
  margin-left: 280px;
}

.text-transparent {
  color: rgba(255, 255, 255, 0.6) !important;
}

.badge-text {
  font-size: 0.5rem;
}

@media (max-width: 960px) {
  .top-navi-bar {
    margin-left: 0 !important;
  }
  .extended-sidebar {
    margin-left: 0 !important;
  }
}
</style>
