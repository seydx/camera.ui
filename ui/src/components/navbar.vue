<template lang="pug">
div
  .d-flex.flex-wrap.align-content-center.navbar2
    .navbar2-inner.container.d-flex.flex-wrap.align-content-center.mt-save.toggleArea
      b-navbar.w-100.p-0.m-0(variant='faded' type='light')
        b-navbar-brand(href='/dashboard')
          img.navbar-brand-img.d-inline-block.align-middle.theme-img(src='@/assets/img/logo_transparent-256@pink.png', alt='camera.ui')
          | {{ name }}
        .navbar2-items.w-100.justify-content-end
          ul
            li.nav-item(v-if="checkLevel('dashboard:access')")
              router-link.nav-link(to="/dashboard") {{ $t("dashboard") }}

            li.nav-item(v-if="checkLevel('cameras:access')")
              router-link.nav-link(to="/cameras") {{ $t("cameras") }}

            li.nav-item(v-if="checkLevel('recordings:access')")
              router-link.nav-link(to="/recordings") {{ $t("recordings") }}

            li.nav-item(v-if="checkLevel('notifications:access')")
              router-link.nav-link(to="/notifications") {{ $t("notifications") }}
                span.notbadge.badge.badge-light.ml-2 {{ notSize }}

            li.nav-item(v-if="checkLevel('settings:profile:access')")
              router-link.nav-link(to="/settings/profile", :class="$route.path.includes('settings') ? 'router-link-exact-active router-link-active' : ''") {{ $t("settings") }}
            
            li.nav-item.camview-btn(v-if="checkLevel('camview:access')")
              router-link.nav-link(to="/camview") {{ $t("camview") }}
            
            li.nav-item.logout-btn
              b-link.nav-link.text-white(v-on:click.native="handleLogout") {{ $t("signout") }}
        toggler(
          :notSize="notSize"
          @logOut="handleLogout"
        )
</template>

<script>
import theme from '@/mixins/theme.mixin';
import toggler from '@/components/toggler.vue';

export default {
  name: 'Navbar',
  components: {
    toggler,
  },
  mixins: [theme],
  props: {
    name: {
      type: String,
      default: 'camera.ui',
    },
  },
  computed: {
    notSize() {
      return this.$store.state.notifications.size;
    },
  },
  mounted() {
    document.addEventListener('scroll', this.navbarScrollHandler);
  },
  beforeDestroy() {
    document.removeEventListener('scroll', this.navbarScrollHandler);
  },
  methods: {
    async handleLogout() {
      await this.$store.dispatch('auth/logout');
      this.$router.push('/');
    },
    navbarScrollHandler() {
      const navbar = document.querySelector('.navbar2-inner');
      const navbarBrand = document.querySelector('.navbar-brand');
      const navbarBrandIMG = document.querySelector('.navbar-brand-img');
      if (window.scrollY > 10) {
        navbar.classList.add('navbar2-inner-minify');
        navbarBrand.classList.add('navbar-brand-minify');
        navbarBrandIMG.classList.add('navbar-brand-img-minify');
      } else {
        navbar.classList.remove('navbar2-inner-minify');
        navbarBrand.classList.remove('navbar-brand-minify');
        navbarBrandIMG.classList.remove('navbar-brand-img-minify');
      }
    },
  },
};
</script>

<style scoped>
.navbar2 {
  background: var(--secondary-bg-color) !important;
  border-bottom: 3px solid rgba(0, 0, 0, 0.05) !important;
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 90;
  transform: translate3d(0, 0, 0);
  -webkit-transform: translate3d(0, 0, 0);
}

.navbar-light .navbar-brand {
  color: var(--primary-font-color);
}

.navbar2-inner {
  height: 90px;
  transition: 0.3s all;
}

.navbar2-inner-minify {
  height: 60px;
}

.navbar-brand {
  transition: 0.3s all;
}

.navbar-brand-minify {
  font-size: 1rem !important;
}

.navbar-brand-img {
  transition: 0.3s all;
  object-fit: cover;
  max-width: 45px;
  max-height: 45px;
}

.navbar-brand-img-minify {
  max-width: 35px;
  max-height: 35px;
}

.navbar2-items {
  display: none !important;
  font-size: 0.8rem;
}

.navbar2-items ul {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
}

.navbar2-items ul li a {
  color: var(--primary-font-color);
}

.navbar2-items ul li a:hover {
  color: var(--primary-color);
}

div.navbar2-items > ul > li > .nav-link {
  padding: 0.5rem 0.7rem;
}

div.navbar2-items > ul > li > a.router-link-active {
  color: var(--primary-color) !important;
}

.camview-btn {
  background: var(--third-bg-color);
  border-radius: 5px;
  transition: 0.3s all;
  margin-right: 5px;
}

.camview-btn:hover {
  background: var(--third-bg-color-hover);
}

.camview-btn a:hover {
  color: var(--primary-font-color) !important;
}

.logout-btn {
  background: var(--primary-color);
  border-radius: 5px;
  transition: 0.3s all;
}

.logout-btn:hover {
  background: var(--secondary-color);
}

.logout-btn a {
  color: #fff !important;
}

.logout-btn a:hover {
  color: #fff !important;
}

@media (min-width: 992px) {
  .navbar2-items {
    display: flex !important;
  }
}

@media (min-width: 1200px) {
  .navbar2-items {
    font-size: 0.9rem;
  }
}
</style>
