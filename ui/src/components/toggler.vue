<template lang="pug">
#toggler.toggler.d-flex.w-100.justify-content-end.position-relative.toggleArea
  b-link#togglerBtn.navbar2-toggler(aria-label="Mobile Navigation")
    b-icon.navbar-2toggler-icon(icon="list", aria-hidden="true")
  .navbar2-collapsed
    ul.h-100
      li.nav-item(v-if="checkLevel('dashboard:access')")
        router-link#DashboardLink.nav-link(to="/dashboard") {{ $t("dashboard") }}
      
      li.nav-item(v-if="checkLevel('cameras:access')")
        router-link.nav-link(to="/cameras") {{ $t("cameras") }}
      
      li.nav-item(v-if="checkLevel('recordings:access')")
        router-link.nav-link(to="/recordings") {{ $t("recordings") }}
      
      li.nav-item(v-if="checkLevel('notifications:access')")
        router-link.nav-link(to="/notifications") {{ $t("notifications") }}
          span.notbadge.badge.badge-light.ml-2 {{ notSize }}
      
      li.nav-item(v-if="checkLevel('settings:profile:access')")
        router-link.nav-link(to="/settings/profile", :class="$route.path.includes('settings') ? 'router-link-exact-active router-link-active' : ''") {{ $t("settings") }}
      
      li.nav-item(v-if="checkLevel('camview:access')")
        router-link.nav-link(to="/camview") {{ $t("camview") }}
      
      li.nav-item
        b-link.nav-link(v-on:click.native="handleLogout") {{ $t("signout") }}
</template>

<script>
import { BIcon, BIconList } from 'bootstrap-vue';

export default {
  name: 'Toggler',
  components: {
    BIcon,
    BIconList,
  },
  props: {
    notSize: {
      type: Number,
      default: 0,
    },
  },
  mounted() {
    document.addEventListener('click', this.navbarClickHandler);
  },
  beforeDestroy() {
    document.removeEventListener('click', this.navbarClickHandler);
  },
  methods: {
    handleLogout() {
      this.$emit('logOut');
    },
    navbarClickHandler(event) {
      const target = event.target;
      const toggleMenu = document.querySelector('.navbar2-collapsed');
      const toggler_clicked = target.closest('#togglerBtn');
      const navItem_clicked = target.classList.contains('nav-link');
      const navi_expanded = toggleMenu.classList.contains('navbar2-collapsed-expand');

      const togglerButton = document.querySelector('#togglerBtn');

      if (
        (navi_expanded && toggler_clicked && !navItem_clicked) ||
        (navi_expanded && !navItem_clicked && !toggler_clicked)
      ) {
        togglerButton.classList.remove('bg-transparent');
        toggleMenu.classList.remove('navbar2-collapsed-expand');
      } else if (!navi_expanded && toggler_clicked) {
        toggleMenu.classList.add('navbar2-collapsed-expand');
        togglerButton.classList.add('bg-transparent');
      }
    },
  },
};
</script>

<style scoped>
.navbar2-toggler {
  width: 30px;
  height: 30px;
  background: var(--primary-color);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  padding: 0;
  margin: 0;
  color: #fff;
  font-size: 20px;
  z-index: 101;
  border: none;
}

#togglerBtn {
  transition: 0.3s all;
}

.navbar2-toggler:active,
.navbar2-toggler:hover,
.navbar2-toggler:focus {
  box-shadow: none !important;
  border: none !important;
}

@media (hover: hover) {
  .navbar2-toggler:active,
  .navbar2-toggler:hover,
  .navbar2-toggler:focus {
    box-shadow: none !important;
    border: none !important;
    background: var(--secondary-color);
  }
}

.navbar2-toggler-icon {
  margin-top: 4px;
}

.navbar2-collapsed {
  position: absolute;
  background: var(--primary-color);
  width: 100%;
  min-width: 230px;
  height: 30px;
  right: 0;
  top: 0;
  border-top-right-radius: 8px;
  border-bottom-left-radius: 8px;
  z-index: 100;
  display: none;
  font-size: 13px;
  -webkit-box-shadow: 0px 2px 5px -1px rgba(0, 0, 0, 0.5);
  -moz-box-shadow: 0px 2px 5px -1px rgba(0, 0, 0, 0.5);
  box-shadow: 0px 2px 5px -1px rgba(0, 0, 0, 0.5);
  border-bottom: 3px solid var(--secondary-color);
}

.navbar2-collapsed-expand {
  height: 350px;
  max-width: 500px;
  display: block;
}

.navbar2-collapsed ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.navbar2-collapsed ul li a {
  color: #fff;
  transition: 0.3s all;
}

.custom-hover {
  color: #fff;
  background: var(--secondary-color);
}

.navbar2-collapsed ul li:first-child,
.navbar2-collapsed ul li:first-child a:hover {
  border-top-right-radius: 8px;
}

.navbar2-collapsed ul li:last-child,
.navbar2-collapsed ul li:last-child a:hover {
  border-bottom-left-radius: 8px;
}

.navbar2-collapsed ul li a:hover {
  background: var(--secondary-color);
}

div.navbar2-collapsed.navbar2-collapsed-expand > ul > li > .nav-link {
  padding: 15px 10px;
  border-bottom: 1px solid rgb(0 0 0 / 21%);
}

div.navbar2-collapsed.navbar2-collapsed-expand > ul > li:last-child > .nav-link {
  border-bottom: none;
}

div.navbar2-collapsed.navbar2-collapsed-expand > ul > li > a.router-link-active {
  color: #fff;
  background: var(--secondary-color);
}

div.navbar2-collapsed.navbar2-collapsed-expand > ul > li:first-child > a.router-link-active {
  border-top-right-radius: 8px;
}

div.navbar2-collapsed.navbar2-collapsed-expand > ul > li:last-child > a.router-link-active {
  border-bottom-left-radius: 8px;
}

@media (min-width: 992px) {
  .toggler {
    display: none !important;
  }
}
</style>
