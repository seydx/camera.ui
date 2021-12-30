<template lang="pug">
.tw-w-full.tw-flex.tw-flex-col.tw-justify-center.tw-items-center(style="min-height: 100vh")
 
  .login
    .tw-flex.tw-flex-col.tw-p-0
      .login-header.tw-flex.tw-justify-between.tw-items-center
        .tw-block
          h2.tw-leading-10.tw-font-black {{ $t('signin') }}
          span.subtitle.tw-font-medium {{ $t('welcome_message') }} 
            strong.text-primary camera.ui
        .tw-ml-auto
          v-img.logo(src="@/assets/img/logo.svg" width="35px")
      v-row.tw-w-full.tw-m-0.tw-mt-5
        v-col.tw-p-0(cols="3").redline.mr-3
        v-col.tw-p-0(cols="3").grayline
        
      v-form.login-content.tw-mt-5(ref="form" v-model="valid" lazy-validation @submit.prevent="signin")
        
        span.login-input-label {{ $t('username') }}
        v-text-field.tw-mb-0.login-input.tw-text-white(required v-model="user.username" :rules="rules.username" solo background-color="rgba(var(--cui-menu-default-rgb), 0.7)" color="var(--cui-primary)" :label="$t('username')")

        span.login-input-label {{ $t('password') }}
        v-text-field.tw-mb-0.login-input(required autocomplete="current-password" v-model="user.password" :rules="rules.password" solo background-color="rgba(var(--cui-menu-default-rgb), 0.7)" color="var(--cui-primary)" :label="$t('password')" :type="showPassword ? 'text' : 'password'" :append-icon="showPassword ? icons['mdiEye'] : icons['mdiEyeOff']" @click:append="showPassword = !showPassword")
        
        v-btn.login-btn.tw-text-white.tw-mt-2(:loading="loading" block depressed color="var(--cui-primary)" height="48px" type="submit") {{ $t('signin') }}
              
  span.tw-text-xs.text-muted {{ moduleName }} - v{{ version }}
</template>

<script>
import { version } from '../../../../package.json';
import { mdiEye, mdiEyeOff } from '@mdi/js';

import { getConfig } from '@/api/config.api';

export default {
  name: 'Login',

  data() {
    return {
      loading: false,
      loadRestart: false,

      icons: {
        mdiEye,
        mdiEyeOff,
      },

      showPassword: false,

      rules: {
        username: [(v) => !!v || this.$t('username_is_required')],
        password: [(v) => !!v || this.$t('password_is_required')],
      },

      user: {
        username: '',
        password: '',
      },

      valid: true,

      moduleName: 'camera.ui',
      version: version,
    };
  },

  computed: {
    restarted() {
      return Boolean(localStorage.getItem('restarted') === 'true');
    },
    updated() {
      return Boolean(localStorage.getItem('updated') === 'true');
    },
    uiConfig() {
      return this.$store.state.config.ui;
    },
  },

  created() {
    this.loadRestart = this.restarted;

    this.moduleName = this.uiConfig?.env?.moduleName || 'camera.ui';
    this.version = this.uiConfig.version || version;
  },

  mounted() {
    if (this.restarted) {
      localStorage.setItem('restarted', false);
      window.location.reload(true);
    }
  },

  methods: {
    async signin() {
      this.loading = true;

      const valid = this.$refs.form.validate();

      if (valid) {
        try {
          await this.$store.dispatch('auth/login', { ...this.user });

          const response = await getConfig();
          const firstStart = response.data.firstStart;

          if (firstStart) {
            this.$router.push('/start');
          } else {
            this.$router.push('/dashboard');
          }
        } catch (err) {
          this.loading = false;
          console.log(err);

          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            this.$toast.error(this.$t('cannot_login'));
          } else {
            this.$toast.error(err.message);
          }
        }
      } else {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.login {
  width: 100%;
  max-width: 350px;
  margin: 10px;
  background: rgba(var(--cui-bg-card-rgb));
  border-radius: 1rem;
  padding: 2.5rem;
  box-shadow: 0px 2px 1px -1px rgb(0 0 0 / 5%), 0px 1px 1px 0px rgb(0 0 0 / 4%), 0px 1px 3px 0px rgb(0 0 0 / 2%) !important;
}

.login-btn {
  text-transform: none;
  text-indent: unset;
  letter-spacing: unset;
  border-radius: 10px;
}

.redline {
  height: 5px;
  background: var(--cui-primary);
}

.grayline {
  height: 5px;
  background: rgba(var(--cui-text-default-rgb), 0.4);
}

.login-input-label {
  font-size: 0.85rem;
  font-weight: 600;
}

@media (max-width: 400px) {
  .login {
    width: 90%;
    max-width: unset;
  }
}

@media (max-height: 500px) {
  .logo {
    display: none;
  }

  .login-header {
    margin-top: 0 !important;
  }

  .subtitle {
    display: none;
  }
}
</style>
