<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-w-full.tw-flex.tw-justify-center.tw-items-center(style="min-height: 100vh" v-else)
 
  v-stepper.start(v-model='e1')
    v-stepper-header.start-header
      v-stepper-step(:complete='e1 > 1' step='1')
      v-divider
      v-stepper-step(:complete='e1 > 2' step='2')
      v-divider
      v-stepper-step(step='3')
      
    v-stepper-items

      v-stepper-content.start-wrapper(step='1')
        v-card.start-content.tw-flex.tw-justify-center.tw-items-center.tw-flex-col(height="320px")

          .tw-block
            v-img(src="@/assets/img/logo.svg" width="42" height="50")
          h5.tw-text-xl.tw-font-light.tw-mt-3 {{ $t('welcome_message') }}
          h1.tw-text-4xl.tw-font-black.tw-leading-7 camera.ui
          .tw-mt-5.text-muted.tw-text-center.tw-text-sm {{ startMsg1 }}
            br 
            | {{ startMsg2 }}
          
        .tw-flex.tw-justify-center
          v-btn.tw-text-white.tw-my-5(color='var(--cui-primary)' @click='e1 = 2') {{ $t('start') }}
          
      v-stepper-content.start-wrapper(step='2')
        v-card.start-content.tw-flex.tw-justify-center.tw-items-center.tw-flex-col(height="320px")

          .loading(v-if="loadingProgress")
            v-progress-circular(indeterminate color="var(--cui-primary)")

          v-form.login-content.tw-mt-5.tw-w-full(ref="form" v-model="valid" lazy-validation v-else @submit.prevent="change")
            
            span.login-input-label {{ $t('username') }}
            v-text-field.tw-my-0.login-input.tw-text-white(required ref="name" v-model="name" :rules="rules.username" solo background-color="rgba(var(--cui-menu-default-rgb), 0.7)" color="var(--cui-primary)" :label="$t('username')")

            span.login-input-label {{ $t('new_password') }}
            v-text-field.tw-my-0.login-input(required ref="password" v-model="password" :rules="rules.password" solo background-color="rgba(var(--cui-menu-default-rgb), 0.7)" color="var(--cui-primary)" :label="$t('password')" :type="showPassword ? 'text' : 'password'" :append-icon="showPassword ? icons['mdiEye'] : icons['mdiEyeOff']" @click:append="showPassword = !showPassword")

            span.login-input-label {{ $t('new_password_verify') }}
            v-text-field.tw-my-0.login-input(required ref="password2" v-model="password2" :rules="rules.password2" solo background-color="rgba(var(--cui-menu-default-rgb), 0.7)" color="var(--cui-primary)" :label="$t('password')" :type="showPassword2 ? 'text' : 'password'" :append-icon="showPassword2 ? icons['mdiEye'] : icons['mdiEyeOff']" @click:append="showPassword2 = !showPassword2")

        .tw-flex.tw-justify-center
          v-btn.tw-text-white.tw-my-5(color='var(--cui-primary)' @click='change') {{ $t('change') }}

      v-stepper-content.start-wrapper(step='3')
        v-card.start-content.tw-flex.tw-justify-center.tw-items-center.tw-flex-col(height="320px")

          .tw-block
            inline-svg(:src="require('../../assets/img/logo_animated.svg')" title="camera.ui" aria-label="camera.ui" width="78px" height="84px")

          .tw-mt-8.text-muted.tw-text-center.tw-text-base 
            strong.tw-text-white {{ endMsg1 }}
            br
            | {{ endMsg2 }}

        .tw-flex.tw-justify-center
          v-btn.tw-text-white.tw-my-5(color='var(--cui-primary)' @click='signout') {{ $t('signin') }}
          
</template>

<script>
import InlineSvg from 'vue-inline-svg';
import { mdiEye, mdiEyeOff } from '@mdi/js';

import { changeUser } from '@/api/users.api';
import { changeSetting } from '@/api/settings.api';
import { getConfig } from '@/api/config.api';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Start',

  components: {
    InlineSvg,
  },

  data() {
    return {
      loading: true,
      loadingProgress: false,

      icons: {
        mdiEye,
        mdiEyeOff,
      },

      startMsg1: this.$t('start_info_message').split(' <br>')[0],
      startMsg2: this.$t('start_info_message').split('<br> ')[1],
      endMsg1: this.$t('start_end_message').split(' <br>')[0],
      endMsg2: this.$t('start_end_message').split('<br> ')[1],

      e1: 1,

      name: '',
      password: '',
      password2: '',
      rules: {
        username: [],
        password: [],
        password2: [],
      },
      showPassword: false,
      showPassword2: false,
      valid: true,
    };
  },

  computed: {
    currentUser() {
      return this.$store.state.auth.user;
    },
  },

  created() {
    this.rules = {
      username: [
        (v) => (!!v && !!v.trim()) || this.$t('username_is_required'),
        (v) => v !== 'master' || this.$t('invalid_username'),
      ],
      password: [
        (v) => (!!v && !!v.trim()) || this.$t('password_is_required'),
        (v) => v !== 'master' || this.$t('invalid_password'),
      ],
      password2: [
        (v) =>
          v ? v === this.password || this.$t('password_not_match') : !this.password || this.$t('password_reenter'),
      ],
    };
  },

  async mounted() {
    try {
      const response = await getConfig();
      const firstStart = response.data.firstStart;

      if (!firstStart) {
        return this.$router.push('/dashboard');
      }

      this.loading = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err);
    }
  },

  methods: {
    async change() {
      this.loadingProgress = true;

      const valid = this.$refs.form.validate();

      if (valid) {
        await timeout(500);

        try {
          await changeUser(this.currentUser.username, {
            username: this.name,
            password: this.password,
          });

          await changeSetting(
            'firstStart',
            {
              firstStart: false,
            },
            '?all=true'
          );

          this.$toast.success(this.$t('successfully_changed'));

          this.e1 = 3;
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);

          this.e1 = 1;
        }
      }

      this.loadingProgress = false;
    },
    async signout() {
      await this.$store.dispatch('auth/logout');
      setTimeout(() => this.$router.push('/'), 200);
    },
  },
};
</script>

<style scoped>
.start {
  background: rgba(var(--cui-bg-card-rgb)) !important;
  width: 100%;
  min-width: 250px;
  max-width: 400px;
  margin: 10px;
  border-radius: 1rem !important;
  box-shadow: 0px 2px 1px -1px rgb(0 0 0 / 5%), 0px 1px 1px 0px rgb(0 0 0 / 4%), 0px 1px 3px 0px rgb(0 0 0 / 2%) !important;
}
.start-header {
  background: rgba(var(--cui-bg-dialog-rgb), 1) !important;
  border-bottom: 1px solid var(--cui-bg-settings-border) !important;
  box-shadow: unset !important;
}

.start-content {
  box-shadow: unset !important;
  background: none !important;
}

.v-stepper .v-stepper__step__step {
  color: #fff !important;
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
