<template lang="pug">
.tw-flex.tw-flex-col.tw-overflow-y-auto.tw-pt-4.tw-px-5(:class="($route.meta.config.showMinifiedNavbar ? 'minified-navi ' : 'main-navi ') + (showSidebar ? 'main-navi-show' : '')" v-click-outside="{ handler: hideNavi, include: include }")
  
  .tw-flex.tw-flex-row.tw-justify-between.pt-safe.pl-safe
    .logo.tw-cursor-pointer(@click="$router.push('/dashboard')")
      inline-svg(:src="require('../assets/img/logo_animated.svg')" title="camera.ui" aria-label="camera.ui" width="38px" height="44px")

    .tw-block.tw-ml-auto(v-if="showSidebarContent")
      v-menu.included.tw-z-30(v-model="showProfileMenu" transition="slide-y-transition" min-width="220px" :close-on-content-click="false" offset-y bottom left nudge-top="-15" z-index="999" content-class="light-shadow")
        template(v-slot:activator="{ on, attrs }")
          v-btn.tw-text-white(icon height="38px" width="38px" v-bind="attrs" v-on="on")
            v-icon {{ icons['mdiAccount'] }}

        v-card.included.light-shadow.card-border.dropdown-content(min-width="220px" max-width="260px")
          v-list-item.tw-px-6.tw-py-3.profile-menu-header.dropdown-title
            v-list-item-action.tw-m-0
              v-avatar(size="40" color="black")
                v-img(v-on:error="handleErrorImg" :src="avatarSrc" :alt="currentUser.username")
                  template(v-slot:placeholder)
                    .tw-flex.tw-justify-center.tw-items-center.tw-h-full
                      v-progress-circular(indeterminate color="var(--cui-primary)" size="16")
            v-list-item-content.tw-ml-3
              v-list-item-title
                .text-left.tw-text-sm.tw-font-medium {{ currentUser.username }}
                .text-left.tw-text-xs.tw-font-light.text-muted {{ currentUser.permissionLevel && currentUser.permissionLevel.includes("admin") ? $t("master") : $t("user") }}
          v-divider
          v-card-text.tw-py-3.tw-px-5.text-center

            v-list.dropdown-content(dense)
              v-list-item-group
                v-list-item(@click="() => { hideNavi(); $router.push('/settings/account') }")
                  v-list-item-icon.tw-mr-4
                    v-icon.touch-button-icon-light-nohover {{ icons['mdiAccountOutline'] }}
                  v-list-item-content.text-left
                    v-list-item-title.tw-text-xs.tw-font-medium.touch-button-icon-light-nohover {{ $t('account') }}
                v-divider(v-if="checkLevel('admin')")
                v-list-item(v-if="checkLevel('admin')" @click="() => { hideNavi(); $router.push('/settings/system') }")
                  v-list-item-icon.tw-mr-4
                    v-icon.touch-button-icon-light-nohover {{ icons['mdiTune'] }}
                  v-list-item-content.text-left
                    v-list-item-title.tw-text-xs.tw-font-medium.touch-button-icon-light-nohover {{ $t('system') }}

          v-divider
          v-card-text.tw-py-1.tw-px-5.text-center

            v-list.dropdown-content(dense flat)
              v-list-item-group
                v-list-item(@click="signout")
                  v-list-item-icon.tw-mr-4
                    v-icon.touch-button-icon-light-nohover {{ icons['mdiLogoutVariant'] }}
                  v-list-item-content.text-left
                    v-list-item-title.tw-text-xs.tw-font-medium.touch-button-icon-light-nohover {{ $t('signout') }}
  
  transition-group.tw-h-full.tw-w-full.pl-safe.pb-safe(tag="div" name='fade' mode='out-in')
  
    .tw-flex.tw-flex-col.tw-h-full.tw-pt-5(v-if="showSidebarContent" key="avatar")
      
      .tw-w-full.tw-text-center.tw-mb-10
        v-avatar.tw-mt-5(size="120" color="#121212")
          v-img(v-on:error="handleErrorImg" :src="avatarSrc" :alt="currentUser.username" style="border: 1px solid #1a1a1a")
            template(v-slot:placeholder)
              .tw-flex.tw-justify-center.tw-items-center.tw-h-full
                v-progress-circular(indeterminate color="var(--cui-primary)" size="22")
        .tw-w-full.tw-text-l.tw-leading-2.tw-mt-6.tw-text-white.tw-font-bold.tw-text-xl {{ currentUser.username }}
        .tw-w-full.tw-text-sm.tw-leading-1.text-muted {{ currentUser.permissionLevel && currentUser.permissionLevel.includes("admin") ? $t("master") : $t("user") }}
      
      .tw-flex.tw-items-center.sidebar-nav-items(v-for="point in navigation" :key="point.name" v-if="point.main && checkLevel(point.requiredLevel)")
        .nav-active(:class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'nav-active-show' : ''")
        v-btn.tw-justify-start.sidebar-nav-item(@click="hideNavi" :to="point.redirect || point.to" active-class="sidebar-nav-item-active" :class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'sidebar-nav-item-active v-btn--active' : ''" plain block tile)
          v-icon(height="24px" width="24px").tw-mr-4 {{ icons[point.icon] }}
          span.sidebar-nav-item-text {{ $t(point.name.toLowerCase()) }}
          
      v-divider.siderbar-nav-divider.tw-my-3
      
      .tw-flex.tw-items-center.sidebar-nav-items(v-for="point in navigation" :key="point.name" v-if="point.extras && checkLevel(point.requiredLevel)")
        .nav-active(:class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'nav-active-show' : ''")
        v-btn.tw-justify-start.sidebar-nav-item(@click="hideNavi" :to="point.redirect || point.to" active-class="sidebar-nav-item-active" :class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'sidebar-nav-item-active v-btn--active' : ''" plain block tile)
          v-icon(height="24px" width="24px").tw-mr-4 {{ icons[point.icon] }}
          span.sidebar-nav-item-text {{ $t(point.name.toLowerCase()) }}
          
      .tw-my-3
          
      .tw-mt-auto
        v-divider.siderbar-nav-divider.tw-mb-3
        
        .tw-flex.tw-items-center.sidebar-nav-items(v-for="point in navigation" :key="point.name" v-if="point.bottom && checkLevel(point.requiredLevel)")
          .nav-active(:class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'nav-active-show' : ''")
          v-btn.tw-justify-start.sidebar-nav-item(@click="hideNavi" :to="point.redirect || point.to" active-class="sidebar-nav-item-active" :class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'sidebar-nav-item-active v-btn--active' : ''" plain block tile)
            v-icon(height="24px" width="24px").tw-mr-4 {{ icons[point.icon] }}
            span.sidebar-nav-item-text {{ $t(point.name.toLowerCase()) }}
            
        .tw-block.tw-text-center.tw-my-2.sidebar-nav-footer
          span.version v{{ version.split('-')[0] }}

    .tw-flex.tw-flex-col.tw-h-full.tw.tw-pt-10(v-if="showSidebarMinifiedNav" key="nav")
      
      .tw-flex.tw-items-center.sidebar-nav-items(v-for="point in navigation" :key="point.name" v-if="point.main && checkLevel(point.requiredLevel)")
        .nav-active(:class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'nav-active-show' : ''")
        v-btn.tw-p-0.tw-justify-center.sidebar-nav-item-minified(@click="hideNavi" :to="point.redirect || point.to" active-class="sidebar-nav-item-minified-active" :class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'sidebar-nav-item-minified-active v-btn--active' : ''" plain block tile)
          v-icon(height="24px" width="24px") {{ icons[point.icon] }}
          
      v-divider.siderbar-nav-divider.tw-my-3
      
      .tw-flex.tw-items-center.sidebar-nav-items(v-for="point in navigation" :key="point.name" v-if="point.extras && checkLevel(point.requiredLevel)")
        .nav-active(:class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'nav-active-show' : ''")
        v-btn.tw-p-0.tw-justify-center.sidebar-nav-item-minified(@click="hideNavi" :to="point.redirect || point.to" active-class="sidebar-nav-item-minified-active" :class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'sidebar-nav-item-minified-active v-btn--active' : ''" plain block tile)
          v-icon(height="24px" width="24px") {{ icons[point.icon] }}
      
      .tw-my-6
          
      .tw-mt-auto
        v-divider.siderbar-nav-divider.tw-mb-3
        
        .tw-flex.tw-items-center.sidebar-nav-items(v-for="point in navigation" :key="point.name" v-if="point.bottom && checkLevel(point.requiredLevel)")
          .nav-active(:class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'nav-active-show' : ''")
          v-btn.tw-p-0.tw-justify-center.sidebar-nav-item-minified(@click="hideNavi" :to="point.redirect || point.to" active-class="sidebar-nav-item-minified-active" :class="$route.path === point.to || $route.path.split('/')[1] === point.to.replace('/', '') || ($route.name === point.name && !$route.meta.child) ? 'sidebar-nav-item-minified-active v-btn--active' : ''" plain block tile)
            v-icon(height="24px" width="24px") {{ icons[point.icon] }}
            
        .tw-block.tw-text-center.tw-my-2.sidebar-nav-footer
          span.version v{{ version.split('-')[0] }}

</template>

<script>
import InlineSvg from 'vue-inline-svg';
import {
  mdiAccount,
  mdiAccountOutline,
  mdiChartArc,
  mdiCog,
  mdiConsole,
  mdiGridLarge,
  mdiLogoutVariant,
  mdiBell,
  mdiCctv,
  mdiImageMultiple,
  mdiScript,
  mdiTextBoxOutline,
  mdiPuzzle,
  mdiTune,
  mdiViewDashboard,
} from '@mdi/js';
import { version } from '../../../package.json';

import { bus } from '@/main';
import { routes } from '@/router';

export default {
  name: 'Sidebar',

  components: {
    InlineSvg,
  },

  data() {
    return {
      avatarSrc: '',
      mdiAccount: mdiAccount,
      mdiAccountOutline: mdiAccountOutline,
      mdiLogoutVariant: mdiLogoutVariant,
      mdiTune: mdiTune,

      icons: {
        mdiAccount,
        mdiAccountOutline,
        mdiLogoutVariant,
        mdiTune,
        'mdi-bell': mdiBell,
        'mdi-cctv': mdiCctv,
        'mdi-chart-arc': mdiChartArc,
        'mdi-cog': mdiCog,
        'mdi-console': mdiConsole,
        'mdi-grid-large': mdiGridLarge,
        'mdi-image-multiple': mdiImageMultiple,
        'mdi-puzzle': mdiPuzzle,
        'mdi-script': mdiScript,
        'mdi-text-box-outline': mdiTextBoxOutline,
        'mdi-view-dashboard': mdiViewDashboard,
      },

      navigation: routes
        .map((route) => {
          if (route.meta.navigation) {
            return {
              name: route.name,
              to: route.path,
              redirect: route.meta.redirectTo,
              ...route.meta.navigation,
              ...route.meta.auth,
            };
          }
        })
        .filter((route) => route),
      showProfileMenu: false,
      showSidebar: false,
      showSidebarContent: false,
      showSidebarMinifiedNav: true,

      version: version,
    };
  },

  computed: {
    currentUser() {
      return this.$store.state.auth.user || {};
    },
    uiConfig() {
      return this.$store.state.config.ui;
    },
  },

  watch: {
    currentUser: {
      handler(newValue) {
        if (newValue?.photo) {
          this.avatarSrc = `/files/${newValue.photo}?rnd=${new Date()}`;
        }
      },
      deep: true,
    },
    '$route.path': {
      handler() {
        if (this.showSidebar) {
          this.hideNavi();
        }
      },
    },
  },

  created() {
    bus.$on('extendSidebarQuery', this.triggerSidebarQuery);
    bus.$on('showSidebar', this.toggleNavi);

    if (this.currentUser.photo && this.currentUser.photo !== 'no_img.png') {
      this.avatarSrc = `/files/${this.currentUser.photo}`;
    } else {
      this.avatarSrc = require('../assets/img/no_user.png');
    }

    this.version = this.uiConfig?.version || version;
  },

  mounted() {
    this.scrollNavi();
  },

  beforeDestroy() {
    bus.$off('extendSidebarQuery', this.triggerSidebarQuery);
    bus.$off('showSidebar', this.toggleNavi);
  },

  methods: {
    triggerSidebarQuery() {
      bus.$emit('extendSidebar', this.showSidebar);
    },
    include() {
      return [...document.querySelectorAll('.included')];
    },
    handleErrorImg() {
      this.avatarSrc = require('../assets/img/no_user.png');
    },
    hideNavi() {
      this.showSidebar = this.showSidebarContent = this.showProfileMenu = false;
      this.showSidebarMinifiedNav = true;

      bus.$emit('showOverlay', false);
      bus.$emit('extendSidebar', false);
    },
    scrollNavi() {
      const activeNav = document.querySelector('.sidebar-nav-item-minified-active');
      const mainNavi = document.querySelector('.main-navi');

      if (activeNav && mainNavi) {
        this.$vuetify.goTo(activeNav, {
          container: mainNavi,
          duration: 250,
          offset: 50,
          easing: 'easeInOutCubic',
        });
      }
    },
    async signout() {
      this.hideNavi();

      await this.$store.dispatch('auth/logout');
      setTimeout(() => this.$router.push('/'), 200);
    },
    toggleNavi(state) {
      state = this.showSidebar ? !state : state;
      this.showSidebar = state;

      bus.$emit('extendSidebar', state);

      if (state) {
        this.showSidebarMinifiedNav = !state;

        setTimeout(() => {
          this.showSidebarContent = state;
        }, 200);
      } else {
        this.showProfileMenu = state;
        this.showSidebarContent = state;
        this.showSidebarMinifiedNav = !state;
      }
    },
  },
};
</script>

<style scoped>
.fade-enter-active {
  transition-duration: 0.3s;
  transition-property: all;
  transition-timing-function: ease-in-out;
  transition-delay: 0s;
}

.fade-leave-leave {
  transition-duration: 0.3s;
  transition-property: all;
  transition-timing-function: ease-in-out;
  transition-delay: 0s;
}

.fade-enter,
.fade-leave-active {
  opacity: 0;
}

.minified-navi,
.main-navi {
  background: rgba(var(--cui-bg-nav-rgb));
  border-right: 1px solid rgba(var(--cui-bg-nav-border-rgb));
  position: fixed;
  top: 0;
  bottom: 0;
  width: 78px;
  min-width: 78px;
  max-width: 280px;
  transition: 0.2s all;
  z-index: 999;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.main-navi::-webkit-scrollbar {
  width: 0px;
  display: none;
}

.main-navi-show {
  width: 280px;
  min-width: 280px;
  margin-left: 0px !important;
}

.logo {
  width: 38px;
  height: 44px;
  transition: 0.2s all;
}

.logo-shrink {
  width: 26px !important;
  height: 32px !important;
}

.sidebar-nav-items {
  height: 48px !important;
  width: 100%;
}

.sidebar-nav-items-bottom {
  margin-bottom: 44px;
}

.sidebar-nav-item,
.sidebar-nav-item-minified {
  color: rgba(255, 255, 255, 0.6);
  transition: 0.2s all;
  border-radius: 6px !important;
  margin-left: calc(1.25rem - 3px) !important;
  height: 44px !important;
}

.sidebar-nav-item-active,
.sidebar-nav-item:hover,
.sidebar-nav-item-minified-active,
.sidebar-nav-item-minified:hover {
  color: rgba(255, 255, 255, 1);
}

.sidebar-nav-item-text {
  font-weight: 600 !important;
  font-size: 13px !important;
  text-transform: none !important;
  letter-spacing: normal !important;
}

.sidebar-nav-item-minified {
  margin-left: calc(1rem - 3px) !important;
}

.siderbar-nav-divider {
  border-color: rgba(255, 255, 255, 0.06) !important;
}

.nav-active {
  margin-left: -1.25rem !important;
  border-radius: 6px !important;
  padding: 0 !important;
  width: 3px;
  height: 48px;
  background: none !important;
}

.nav-active-show {
  margin-left: -1.25rem !important;
  border-radius: 6px !important;
  padding: 0 !important;
  width: 3px;
  height: 48px;
  background: rgba(var(--cui-primary-rgb)) !important;
}

.sidebar-nav-footer {
  /*height: 39px;*/
}

.profile-menu-header {
  background: rgba(var(--cui-bg-default-rgb), 0.5) !important;
  border-top-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
}

.profile-menu-active {
  color: var(--cui-text-default) !important;
  font-weight: 600 !important;
}

.version {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.1);
}

.minified-navi {
  position: fixed;
  margin-left: -280px;
}

@media (max-width: 960px) {
  .main-navi {
    margin-left: -280px;
  }
}

/***************************************************
 * Generated by SVG Artista on 11/29/2021, 8:21:16 AM
 * MIT license (https://opensource.org/licenses/MIT)
 * W. https://svgartista.net
 **************************************************/

/*@-webkit-keyframes animate-svg-stroke-1 {
  0% {
    stroke-dashoffset: 307.3293151855469px;
    stroke-dasharray: 307.3293151855469px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 307.3293151855469px;
  }
}

@keyframes animate-svg-stroke-1 {
  0% {
    stroke-dashoffset: 307.3293151855469px;
    stroke-dasharray: 307.3293151855469px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 307.3293151855469px;
  }
}

@-webkit-keyframes animate-svg-fill-1 {
  0% {
    fill: transparent;
  }

  100% {
    fill: url('#dark_wine');
  }
}

@keyframes animate-svg-fill-1 {
  0% {
    fill: transparent;
  }

  100% {
    fill: url('#dark_wine');
  }
}

div >>> .svg-elem-1 {
  -webkit-animation: animate-svg-stroke-1 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0s both,
    animate-svg-fill-1 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 0.8s both;
  animation: animate-svg-stroke-1 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0s both,
    animate-svg-fill-1 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 0.8s both;
}

@-webkit-keyframes animate-svg-stroke-2 {
  0% {
    stroke-dashoffset: 460.2838439941406px;
    stroke-dasharray: 460.2838439941406px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 460.2838439941406px;
  }
}

@keyframes animate-svg-stroke-2 {
  0% {
    stroke-dashoffset: 460.2838439941406px;
    stroke-dasharray: 460.2838439941406px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 460.2838439941406px;
  }
}

@-webkit-keyframes animate-svg-fill-2 {
  0% {
    fill: transparent;
  }

  100% {
    fill: url('#light_wine');
  }
}

@keyframes animate-svg-fill-2 {
  0% {
    fill: transparent;
  }

  100% {
    fill: url('#light_wine');
  }
}

div >>> .svg-elem-2 {
  -webkit-animation: animate-svg-stroke-2 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.12s both,
    animate-svg-fill-2 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 0.9s both;
  animation: animate-svg-stroke-2 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.12s both,
    animate-svg-fill-2 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 0.9s both;
}*/

@-webkit-keyframes animate-svg-stroke-3 {
  0% {
    stroke-dashoffset: 119.24423783197108px;
    stroke-dasharray: 119.24423783197108px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 119.24423783197108px;
  }
}

@keyframes animate-svg-stroke-3 {
  0% {
    stroke-dashoffset: 119.24423783197108px;
    stroke-dasharray: 119.24423783197108px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 119.24423783197108px;
  }
}

@-webkit-keyframes animate-svg-fill-3 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(197, 198, 200);
  }
}

@keyframes animate-svg-fill-3 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(197, 198, 200);
  }
}

div >>> .svg-elem-3 {
  -webkit-animation: animate-svg-stroke-3 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.24s both,
    animate-svg-fill-3 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1s both;
  animation: animate-svg-stroke-3 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.24s both,
    animate-svg-fill-3 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1s both;
}

@-webkit-keyframes animate-svg-stroke-4 {
  0% {
    stroke-dashoffset: 72.2947006225586px;
    stroke-dasharray: 72.2947006225586px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 72.2947006225586px;
  }
}

@keyframes animate-svg-stroke-4 {
  0% {
    stroke-dashoffset: 72.2947006225586px;
    stroke-dasharray: 72.2947006225586px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 72.2947006225586px;
  }
}

@-webkit-keyframes animate-svg-fill-4 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(26, 30, 33);
  }
}

@keyframes animate-svg-fill-4 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(26, 30, 33);
  }
}

div >>> .svg-elem-4 {
  -webkit-animation: animate-svg-stroke-4 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.36s both,
    animate-svg-fill-4 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.1s both;
  animation: animate-svg-stroke-4 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.36s both,
    animate-svg-fill-4 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.1s both;
}

@-webkit-keyframes animate-svg-stroke-5 {
  0% {
    stroke-dashoffset: 12.32623871258889px;
    stroke-dasharray: 12.32623871258889px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 12.32623871258889px;
  }
}

@keyframes animate-svg-stroke-5 {
  0% {
    stroke-dashoffset: 12.32623871258889px;
    stroke-dasharray: 12.32623871258889px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 12.32623871258889px;
  }
}

@-webkit-keyframes animate-svg-fill-5 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(255, 255, 255);
  }
}

@keyframes animate-svg-fill-5 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(255, 255, 255);
  }
}

div >>> .svg-elem-5 {
  -webkit-animation: animate-svg-stroke-5 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.48s both,
    animate-svg-fill-5 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.2000000000000002s both;
  animation: animate-svg-stroke-5 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.48s both,
    animate-svg-fill-5 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.2000000000000002s both;
}

@-webkit-keyframes animate-svg-stroke-6 {
  0% {
    stroke-dashoffset: 12.32623871258889px;
    stroke-dasharray: 12.32623871258889px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 12.32623871258889px;
  }
}

@keyframes animate-svg-stroke-6 {
  0% {
    stroke-dashoffset: 12.32623871258889px;
    stroke-dasharray: 12.32623871258889px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 12.32623871258889px;
  }
}

@-webkit-keyframes animate-svg-fill-6 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(255, 255, 255);
  }
}

@keyframes animate-svg-fill-6 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(255, 255, 255);
  }
}

div >>> .svg-elem-6 {
  -webkit-animation: animate-svg-stroke-6 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.6s both,
    animate-svg-fill-6 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.3s both;
  animation: animate-svg-stroke-6 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.6s both,
    animate-svg-fill-6 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.3s both;
}

@-webkit-keyframes animate-svg-stroke-7 {
  0% {
    stroke-dashoffset: 12.32623871258889px;
    stroke-dasharray: 12.32623871258889px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 12.32623871258889px;
  }
}

@keyframes animate-svg-stroke-7 {
  0% {
    stroke-dashoffset: 12.32623871258889px;
    stroke-dasharray: 12.32623871258889px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 12.32623871258889px;
  }
}

@-webkit-keyframes animate-svg-fill-7 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(255, 255, 255);
  }
}

@keyframes animate-svg-fill-7 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(255, 255, 255);
  }
}

div >>> .svg-elem-7 {
  -webkit-animation: animate-svg-stroke-7 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.72s both,
    animate-svg-fill-7 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.4000000000000001s both;
  animation: animate-svg-stroke-7 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.72s both,
    animate-svg-fill-7 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.4000000000000001s both;
}

@-webkit-keyframes animate-svg-stroke-8 {
  0% {
    stroke-dashoffset: 12.430087609918113px;
    stroke-dasharray: 12.430087609918113px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 12.430087609918113px;
  }
}

@keyframes animate-svg-stroke-8 {
  0% {
    stroke-dashoffset: 12.430087609918113px;
    stroke-dasharray: 12.430087609918113px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 12.430087609918113px;
  }
}

@-webkit-keyframes animate-svg-fill-8 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(255, 255, 255);
  }
}

@keyframes animate-svg-fill-8 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(255, 255, 255);
  }
}

div >>> .svg-elem-8 {
  -webkit-animation: animate-svg-stroke-8 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.84s both,
    animate-svg-fill-8 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.5s both;
  animation: animate-svg-stroke-8 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.84s both,
    animate-svg-fill-8 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.5s both;
}

@-webkit-keyframes animate-svg-stroke-9 {
  0% {
    stroke-dashoffset: 24.203350067138672px;
    stroke-dasharray: 24.203350067138672px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 24.203350067138672px;
  }
}

@keyframes animate-svg-stroke-9 {
  0% {
    stroke-dashoffset: 24.203350067138672px;
    stroke-dasharray: 24.203350067138672px;
  }

  100% {
    stroke-dashoffset: 0;
    stroke-dasharray: 24.203350067138672px;
  }
}

@-webkit-keyframes animate-svg-fill-9 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(255, 255, 255);
  }
}

@keyframes animate-svg-fill-9 {
  0% {
    fill: transparent;
  }

  100% {
    fill: rgb(255, 255, 255);
  }
}

div >>> .svg-elem-9 {
  -webkit-animation: animate-svg-stroke-9 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.96s both,
    animate-svg-fill-9 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.6s both;
  animation: animate-svg-stroke-9 0.5s cubic-bezier(0.47, 0, 0.745, 0.715) 0.96s both,
    animate-svg-fill-9 0.3s cubic-bezier(0.47, 0, 0.745, 0.715) 1.6s both;
}
</style>
