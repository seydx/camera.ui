import Vue from 'vue';
import VueRouter from 'vue-router';

import app from '@/main';
import store from '@/store';

import socket from '@/common/socket-instance';

import { checkLogin } from '@/api/auth.api';

Vue.use(VueRouter);

const routes = [
  {
    path: '*',
    component: () => import(/* webpackChunkName: "404" */ '@/views/notfound/Notfound.vue'),
  },
  {
    path: '/',
    name: 'Login',
    meta: {
      name: 'login',
      requiresAuth: false,
      requiredLevel: [],
    },
    component: () => import(/* webpackChunkName: "login" */ '@/views/login/Login.vue'),
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    meta: {
      name: 'dashboard',
      requiresAuth: true,
      requiredLevel: [/*"cameras:access", */ 'dashboard:access'],
    },
    component: () => import(/* webpackChunkName: "dashboard" */ '@/views/dashboard/Dashboard.vue'),
  },
  {
    path: '/cameras',
    name: 'Cameras',
    meta: {
      name: 'cameras',
      requiresAuth: true,
      requiredLevel: ['cameras:access'],
    },
    component: () => import(/* webpackChunkName: "cameras" */ '@/views/cameras/Cameras.vue'),
  },
  {
    path: '/cameras/:name',
    name: 'Camera',
    meta: {
      name: 'camera',
      requiresAuth: true,
      requiredLevel: ['cameras:access'],
    },
    component: () => import(/* webpackChunkName: "camera" */ '@/views/camera/Camera.vue'),
  },
  {
    path: '/recordings',
    name: 'Recordings',
    meta: {
      name: 'recordings',
      requiresAuth: true,
      requiredLevel: ['recordings:access'],
    },
    component: () => import(/* webpackChunkName: "recordings" */ '@/views/recordings/Recordings.vue'),
  },
  {
    path: '/notifications',
    name: 'Notifications',
    meta: {
      name: 'dashboard',
      requiresAuth: true,
      requiredLevel: ['notifications:access'],
    },
    component: () => import(/* webpackChunkName: "notifications" */ '@/views/notifications/Notifications.vue'),
  },
  {
    path: '/camview',
    name: 'CamView',
    meta: {
      name: 'dashboard',
      requiresAuth: true,
      requiredLevel: [/*"cameras:access", */ 'camview:access'],
    },
    component: () => import(/* webpackChunkName: "camview" */ '@/views/camview/Camview.vue'),
  },
  {
    path: '/settings',
    redirect: '/settings/profile',
    name: 'Settings',
    meta: {
      name: 'dashboard',
      requiresAuth: true,
      requiredLevel: ['settings:access'],
    },
    component: () => import(/* webpackChunkName: "settings" */ '@/views/settings/Settings.vue'),
    children: [
      {
        path: 'profile',
        component: () => import(/* webpackChunkName: "settings" */ '@/views/settings/pages/profile.vue'),
        meta: {
          name: 'profile',
          transitionName: 'slide',
          requiresAuth: true,
          requiredLevel: ['settings:profile:access'],
        },
      },
      {
        path: 'general',
        component: () => import(/* webpackChunkName: "settings" */ '@/views/settings/pages/general.vue'),
        meta: {
          name: 'general',
          transitionName: 'slide',
          requiresAuth: true,
          requiredLevel: ['settings:general:access'],
        },
      },
      {
        path: 'dashboard',
        component: () => import(/* webpackChunkName: "settings" */ '@/views/settings/pages/dashboard.vue'),
        meta: {
          name: 'dashboard',
          transitionName: 'slide',
          requiresAuth: true,
          requiredLevel: ['settings:dashboard:access'],
        },
      },
      {
        path: 'cameras',
        component: () => import(/* webpackChunkName: "settings" */ '@/views/settings/pages/cameras.vue'),
        meta: {
          name: 'cameras',
          transitionName: 'slide',
          requiresAuth: true,
          requiredLevel: ['settings:cameras:access'],
        },
      },
      {
        path: 'recordings',
        component: () => import(/* webpackChunkName: "settings" */ '@/views/settings/pages/recordings.vue'),
        meta: {
          name: 'recordings',
          transitionName: 'slide',
          requiresAuth: true,
          requiredLevel: ['settings:recordings:access'],
        },
      },
      {
        path: 'notifications',
        component: () => import(/* webpackChunkName: "settings" */ '@/views/settings/pages/notifications.vue'),
        meta: {
          name: 'notifications',
          transitionName: 'slide',
          requiresAuth: true,
          requiredLevel: ['settings:notifications:access'],
        },
      },
      {
        path: 'camview',
        component: () => import(/* webpackChunkName: "settings" */ '@/views/settings/pages/camview.vue'),
        meta: {
          name: 'camview',
          transitionName: 'slide',
          requiresAuth: true,
          requiredLevel: ['settings:camview:access'],
        },
      },
    ],
  },
];

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes,
  scrollBehavior() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ x: 0, y: 0, behavior: 'smooth' });
      }, 250);
    });
  },
});

router.beforeEach(async (to, from, next) => {
  const user = store.getters['auth/user'];

  if (user && user.access_token) {
    try {
      await checkLogin();

      if (to.meta.requiredLevel.length > 0) {
        const granted = user.permissionLevel.some(
          (level) => to.meta.requiredLevel.includes(level) || level === 'admin'
        );
        if (!granted) {
          app.$toast.error(`${app.$t(to.meta.name)}: ${app.$t('permission_required')}`);
          return next(false);
        }
      }

      const lastRouteName = localStorage.getItem('lastPage');
      const shouldRedirect = Boolean(to.meta.name === 'login' && lastRouteName);

      if (shouldRedirect) {
        next({ path: lastRouteName });
      } else {
        next();
      }

      socket.open();
    } catch {
      await store.dispatch('auth/logout');
      next('/');
    }
  } else {
    if (to.meta.name !== 'login') {
      next('/');
    } else {
      next();
    }
  }
});

router.afterEach((to) => {
  if (to.meta.name !== 'login') {
    localStorage.setItem('lastPage', to.path);
  }
});

export default router;
