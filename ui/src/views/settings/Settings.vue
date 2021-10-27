<template lang="pug">
div
  BackToTop
  Navbar(:name="$t('settings')")
  .subnavigation.d-flex.flex-wrap.align-content-center.mt-save
    .subnavigation-container.container.d-flex.flex-wrap.align-content-center.justify-content-center.overflow-hidden
      .subnavigation-scrollmenu.d-flex.justify-content-between.horizontal-btn-direction-settings
        router-link.btn.btn-settings.mr-1(v-if="checkLevel('settings:profile:access')", to="/settings/profile", @click.native="subnaviClick('profile')", :class="'sub-profile' + ($route.meta.name === 'profile' ? ' btn-settings-active' : '')") {{ $t("profile") }}
        router-link.btn.btn-settings.mr-1(v-if="checkLevel('settings:general:access')", to="/settings/general", @click.native="subnaviClick('general')", :class="'sub-general' + ($route.meta.name === 'general' ? ' btn-settings-active' : '')") {{ $t("general") }}
        router-link.btn.btn-settings.mr-1(v-if="checkLevel(['settings:dashboard:access', 'settings:dashboard:edit'])", to="/settings/dashboard", @click.native="subnaviClick('dashboard')", :class="'sub-dashboard' + ($route.meta.name === 'dashboard' ? ' btn-settings-active' : '')") {{ $t("dashboard") }}
        router-link.btn.btn-settings.mr-1(v-if="checkLevel(['settings:cameras:access', 'settings:cameras:edit'])", to="/settings/cameras", @click.native="subnaviClick('cameras')", :class="'sub-cameras' + ($route.meta.name === 'cameras' ? ' btn-settings-active' : '')") {{ $t("cameras") }}
        router-link.btn.btn-settings.mr-1(v-if="checkLevel(['settings:recordings:access', 'settings:recordings:edit'])", to="/settings/recordings", @click.native="subnaviClick('recordings')", :class="'sub-recordings' + ($route.meta.name === 'recordings' ? ' btn-settings-active' : '')") {{ $t("recordings") }}
        router-link.btn.btn-settings.mr-1(v-if="checkLevel(['settings:notifications:access', 'settings:notifications:edit'])", to="/settings/notifications", @click.native="subnaviClick('notifications')", :class="'sub-notifications' + ($route.meta.name === 'notifications' ? ' btn-settings-active' : '')") {{ $t("notifications") }}
        router-link.btn.btn-settings.mr-1(v-if="checkLevel(['settings:camview:access', 'settings:camview:edit'])", to="/settings/camview", @click.native="subnaviClick('camview')", :class="'sub-camview' + ($route.meta.name === 'camview' ? ' btn-settings-active' : '')") {{ $t("camview") }}
  main.inner-container.w-100.h-100vh-calc-settings.pt-save.footer-offset
    .container.pt-2
      transition(:name="transitionName", mode="out-in", @beforeLeave="beforeLeave", @enter="enter", @afterEnter="afterEnter")
        router-view(:key="$route.meta.name")
  Footer
</template>

<script>
import DetectSwipe from '@/common/detectswipe';
import BackToTop from '@/components/back-to-top.vue';
import Footer from '@/components/footer.vue';
import Navbar from '@/components/navbar.vue';

const DEFAULT_TRANSITION = 'fade';

Math.easeInOutQuad = (t, b, c, d) => {
  t /= d / 2;
  if (t < 1) {
    return (c / 2) * t * t + b;
  }
  t--;
  return (-c / 2) * (t * (t - 2) - 1) + b;
};

export default {
  name: 'Settings',
  components: {
    BackToTop,
    Footer,
    Navbar,
  },
  data() {
    return {
      prevHeight: 0,
      activeRoute: this.$route.meta.name,
      routeOrder: ['profile', 'general', 'dashboard', 'cameras', 'recordings', 'notifications', 'camview'],
      transitionName: DEFAULT_TRANSITION,
    };
  },
  computed: {
    currentUser() {
      return this.$store.state.auth.user;
    },
  },
  created() {
    this.$router.beforeEach((to, from, next) => {
      let transitionName = to.meta.transitionName || from.meta.transitionName;

      if (transitionName === 'slide') {
        const toDepth = this.routeOrder.indexOf(to.path.split('/')[2]);
        const fromDepth = this.routeOrder.indexOf(from.path.split('/')[2]);

        transitionName = toDepth < fromDepth ? 'slide-right' : 'slide-left';
      }

      this.transitionName = transitionName || DEFAULT_TRANSITION;

      next();
    });
  },
  async mounted() {
    this.subnaviClick(this.activeRoute, true);

    DetectSwipe.detect('main', this.changePage);
    document.addEventListener('scroll', this.minifyScrollHandler);
    window.addEventListener('resize', this.subnaviClick);
  },
  beforeDestroy() {
    DetectSwipe.stop();
    document.removeEventListener('scroll', this.minifyScrollHandler);
    window.removeEventListener('resize', this.subnaviClick);
  },
  methods: {
    afterEnter(element) {
      element.style.height = 'auto';
    },
    beforeLeave(element) {
      if (element) {
        this.prevHeight = getComputedStyle(element).height;
      }
    },
    // eslint-disable-next-line no-unused-vars
    changePage(element, target, direction) {
      const activeButton = document.querySelector('.btn-settings-active');
      const from = activeButton.getAttribute('href').split('/')[2];
      const fromIndex = this.routeOrder.indexOf(from);
      let to;

      if (direction === 'right') {
        const toIndex = fromIndex ? fromIndex - 1 : undefined;
        to = this.routeOrder[toIndex];
      } else if (direction === 'left') {
        const toIndex = fromIndex === this.routeOrder.length - 1 ? undefined : fromIndex + 1;
        to = this.routeOrder[toIndex];
      }

      if (to) {
        this.subnaviClick(to);
        this.$router.push(`/settings/${to}`);
      }
    },
    enter(element) {
      if (element) {
        const { height } = getComputedStyle(element);

        element.style.height = this.prevHeight;

        setTimeout(() => {
          element.style.height = height;
        });
      }
    },
    minifyScrollHandler() {
      const subnavigation = document.querySelector('.subnavigation');
      if (window.scrollY > 10) {
        subnavigation.classList.add('subnavigation-minify');
      } else {
        subnavigation.classList.remove('subnavigation-minify');
      }
    },
    scrollLeft(element, to, duration) {
      let start = element.scrollLeft;
      let change = to - start;
      let currentTime = 0;
      let increment = 20;

      //console.log(`Scrolling start from ${start} to ${to}`);

      const animateScroll = () => {
        currentTime += increment;
        const value = Math.easeInOutQuad(currentTime, start, change, duration);
        element.scrollLeft = value;
        if (currentTime < duration) {
          setTimeout(animateScroll, increment);
        }
      };
      animateScroll();
    },
    subnaviClick(newRoute, start) {
      newRoute = this.routeOrder.includes(newRoute) ? newRoute : this.activeRoute;

      const target = document.querySelector(`.sub-${newRoute}`);
      const scrollmenu = document.querySelector('.subnavigation-scrollmenu');

      const from = this.activeRoute;
      let fromIndex = this.routeOrder.indexOf(from);

      const to = newRoute;
      const toIndex = this.routeOrder.indexOf(to);

      let difEleToWindow;

      if (start) fromIndex = 0;

      if (toIndex > fromIndex) {
        let eleWidth = target.offsetWidth + 100;
        let elementLeft = target.getBoundingClientRect().left;
        let pos = elementLeft + eleWidth;

        if (pos > this.windowWidth()) {
          difEleToWindow = pos - this.windowWidth() + scrollmenu.scrollLeft + 40;
        }
      } else {
        let elementLeft = target.offsetWidth - 100;

        if (elementLeft < 0) {
          difEleToWindow = scrollmenu.scrollLeft + elementLeft - 40;
        }
      }

      if (difEleToWindow !== undefined) {
        this.scrollLeft(scrollmenu, difEleToWindow, 1000);
      }

      //push old route to new route
      this.activeRoute = newRoute;
    },
    windowWidth() {
      let windowWidth = Math.max(document.documentElement.clientWidth, window.innerWidth);
      return windowWidth;
    },
  },
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition-duration: 0.3s;
  transition-property: opacity;
  transition-timing-function: ease;
}

.fade-enter,
.fade-leave-active {
  opacity: 0;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition-duration: 0.5s;
  transition-property: height, opacity, transform;
  transition-timing-function: cubic-bezier(0.55, 0, 0.1, 1);
  overflow: hidden;
}

.slide-left-enter,
.slide-right-leave-active {
  opacity: 0;
  transform: translate(2em, 0);
}

.slide-left-leave-active,
.slide-right-enter {
  opacity: 0;
  transform: translate(-2em, 0);
}

.inner-container {
  margin-top: 160px;
}

.subnavigation {
  background: var(--primary-color);
  color: rgb(161, 147, 147);
  position: fixed;
  left: 0;
  right: 0;
  top: 90px;
  padding-top: 0.4rem;
  padding-bottom: 0.4rem;
  height: 50px;
  -webkit-box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  -moz-box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  transition: 0.3s all;
  transform: translate3d(0, 0, 0);
  -webkit-transform: translate3d(0, 0, 0);
  z-index: 10;
}

.subnavigation-minify {
  top: 60px;
}

.subnavigation-container {
  margin-top: 0;
  overflow: hidden;
  margin-top: 2px;
}

.horizontal-btn-direction-settings {
  overflow: auto;
  white-space: nowrap;
}

.horizontal-btn-direction-settings {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE 10+ */
  overflow-y: scroll;
  overflow-x: hidden;
}

.horizontal-btn-direction-settings::-webkit-scrollbar {
  display: none; /* Chrome Safari */
  width: 0 !important;
  height: 0 !important;
  -webkit-appearance: none;
}

.subnavigation-scrollmenu {
  overflow: auto;
  white-space: nowrap;
}

.btn-settings {
  background: none;
  color: #ffffff;
  font-size: 12px !important;
  -webkit-transition: 0.6s all;
  -o-transition: 0.6s all;
  transition: 0.6s all;
  box-shadow: none !important;
}

.btn-settings:hover {
  background: rgb(255 255 255 / 24%);
}

.btn-settings-active {
  background: rgb(255 255 255 / 24%);
}
</style>

<style>
.settings-box {
  position: relative;
  background: var(--secondary-bg-color);
  padding: 1.5rem !important;
  border-radius: 5px;
  border-bottom: 3px solid var(--third-bg-color);
  -webkit-box-shadow: 0px 17px 28px -21px rgba(0, 0, 0, 0.3);
  box-shadow: 0px 17px 28px -21px rgba(0, 0, 0, 0.3);
}

.settings-box-title {
  font-size: 1rem;
  margin-bottom: 20px;
  font-weight: bold;
}

.settings-box-inner-title {
  background: var(--primary-color);
  padding: 10px;
  border-radius: 5px;
}

.settings-box-header {
  position: relative;
  background: var(--primary-color);
  color: #ffffff;
  padding: 0.75rem 1.5rem !important;
  border-radius: 5px;
  margin-bottom: -5px;
  z-index: 1;
  border-bottom: 2px solid var(--secondary-color);
}

.settings-box-top {
  border-bottom: 1px solid var(--trans-border-color-1);
  margin-bottom: 0 !important;
  padding: 10px 15px;
  font-size: 1rem !important;
}

.expandTriangle {
  font-size: 8px;
  float: right;
  margin-left: 0;
  margin-top: 15px;
  margin-right: 15px;
  color: var(--third-bg-color);
  border-radius: 3px;
}

.expandTriangleCamera {
  z-index: 2;
  position: relative;
  font-size: 8px;
  float: right;
  margin-left: 0;
  margin-top: 20px;
  margin-right: 20px;
  color: #fff;
  border-radius: 3px;
}
</style>
