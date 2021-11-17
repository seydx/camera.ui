<template lang="pug">
main.d-flex.flex-wrap.justify-content-center.align-content-center.h-100vh.w-100
  .container.m-3
    .start-inner.row
      #main.col.d-flex.flex-wrap.justify-content-center
        .row.w-100.justify-content-center
          h3.mb-0.text-center {{ $t("welcome_message") }} 
            b.text-color-primary camera.ui
        .row.w-100.justify-content-center.my-3
          .col-2.greyline
        .row.w-100.justify-content-center
          p.m-0.lh-1-7.text-center {{ $t("help_started") }} 
          b-spinner.text-color-primary.mt-3(v-if="loading")
          b-collapse(
            class="w-100 mt-5"
            id="formCollapse"
          )
            div
              b-form(@submit="onNext")
                #auth
                  h5 📝 {{ $t("account") }} 
                  hr.hr-underline
                  b-form-group(id="input-group-username" :label="$t('username')" label-for="input-username")
                    b-form-input(
                      id="input-username"
                      v-model="form.auth.username"
                      :placeholder="$t('username')"
                      v-disable-leading-space
                    )
                  b-form-group(id="input-group-password" :label="$t('password')" label-for="input-password")
                    b-form-input(
                      id="input-password"
                      v-model="form.auth.password"
                      placeholder="********"
                    )
                  b-form-group(id="input-group-password2" :label="$t('password_reenter')" label-for="input-password2")
                    b-form-input(
                      id="input-password2"
                      v-model="form.auth.reenterpw"
                      placeholder="********"
                    )
                b-button#nextButton.d-block.mt-4.mx-auto.nextButton(type="submit" variant="primary" :pressed="nextButton" :active="nextButton") {{ $t("start") }}
</template>

<script>
import { changeUser } from '@/api/users.api';
import { changeSetting } from '@/api/settings.api';
import { getConfig } from '@/api/config.api';
import SocketMixin from '@/mixins/socket.mixin';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Start',
  data() {
    return {
      loading: true,
      form: {
        auth: {
          username: '',
          password: '',
          reenterpw: '',
        },
      },
      nextButton: false,
      showForm: false,
    };
  },
  mixin: [SocketMixin],
  computed: {
    currentUser() {
      return this.$store.state.auth.user;
    },
  },
  async mounted() {
    await timeout(1000);

    const response = await getConfig();
    const firstStart = response.data.firstStart;

    if (!firstStart) {
      return this.$router.push('/dashboard');
    }

    this.loading = false;
    this.$root.$emit('bv::toggle::collapse', 'formCollapse');
  },
  methods: {
    async onNext(event) {
      const nextButton = document.getElementById('nextButton');

      nextButton.blur();
      this.nextButton = false;

      event.preventDefault();

      if (!this.form.auth.username || this.form.auth.username === '') {
        return this.$toast.error(this.$t('no_username_defined'));
      }

      if (
        !this.form.auth.password ||
        this.form.auth.password === '' ||
        !this.form.auth.reenterpw ||
        this.form.auth.reenterpw === ''
      ) {
        return this.$toast.error(this.$t('no_password_defined'));
      }

      if (this.form.auth.password !== this.form.auth.reenterpw) {
        return this.$toast.error(this.$t('password_not_match'));
      }

      try {
        this.$root.$emit('bv::toggle::collapse', 'formCollapse');
        this.loading = true;

        await timeout(1000);

        await changeUser(this.currentUser.username, {
          username: this.form.auth.username,
          password: this.form.auth.password,
        });

        await changeSetting(
          'firstStart',
          {
            firstStart: false,
          },
          '?all=true'
        );

        this.$toast.success(this.$t('successfully_changed'));

        await this.$store.dispatch('auth/logout');
        setTimeout(() => this.$router.push('/'), 200);
      } catch (error) {
        this.loading = false;
        this.$root.$emit('bv::toggle::collapse', 'formCollapse');

        this.$toast.error(error.message);
      }
    },
  },
};
</script>

<style scoped>
.container {
  max-width: 550px;
  -webkit-box-shadow: 0px 17px 28px -21px rgba(0, 0, 0, 0.68);
  box-shadow: 0px 17px 28px -21px rgba(0, 0, 0, 0.68);
  border-radius: 20px;
}

.start-inner {
  height: 100%;
}

#main {
  padding: 40px;
  background: var(--secondary-bg-color);
  border-radius: 20px;
}

#main p,
#main span {
  color: #c4c4c4;
  font-size: 14px;
}

.redline {
  height: 5px;
  background: var(--primary-color);
}

.greyline {
  height: 5px;
  background: var(--third-bg-color);
}

.nextButton,
.nextButton:hover,
.nextButton:focus {
  color: #ffffff;
}
</style>
