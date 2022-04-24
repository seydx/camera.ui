<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loading" :indeterminate="loading" fixed top color="var(--cui-primary)")

  v-btn.save-btn(:class="fabAbove ? 'save-btn-top' : ''" v-scroll="onScroll" v-show="fab" color="success" transition="fade-transition" width="40" height="40" fab dark fixed bottom right @click="save" :loading="loadingProgress")
    v-icon {{ icons['mdiCheckBold'] }}

  .tw-mb-7.tw-mt-5(v-if="!loading")
    .tw-flex.tw-justify-between
      .tw-block
        .page-subtitle {{ $t('profile') }}
        .page-subtitle-info {{ $t('general_information') }}
      .image-upload.tw-ml-auto
        label.profile-avatar-bg(for='file-input')
          v-img.profile-avatar(v-on:error="handleErrorImg" :src="avatarSrc" alt="Avatar" width="4rem" height="4rem" style="border: 1px solid #1a1a1a")
            template(v-slot:placeholder)
              .tw-flex.tw-justify-center.tw-items-center.tw-h-full
                v-progress-circular(indeterminate color="var(--cui-primary)" size="22")
        input#file-input(type="file", name="photo", placeholder="Photo", required="", accept="image/png,image/jpeg", @change="changeProfileImg")

    v-form.tw-w-full.tw-mt-4.tw-mb-8(ref="form" v-model="valid" lazy-validation)
      label.form-input-label {{ $t('username') }}
      v-text-field(v-model="form.username" :label="$t('username')" prepend-inner-icon="mdi-account" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.username" required solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiAccount'] }}

      label.form-input-label {{ $t('signout_after') }}
      v-select(ref="sessionTimer" :suffix="$t('hours')" :value="form.sessionTimer/3600 > 25 ? $t('never') : form.sessionTimer/3600" :items="sessionTimerSelect" prepend-inner-icon="mdi-timelapse" background-color="var(--cui-bg-card)" required solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiTimelapse'] }}

      label.form-input-label {{ $t('permissions') }}: 
      v-chip.tw-text-white.tw-ml-1(small v-for="perm in currentUser.permissionLevel" :key="perm" color="var(--cui-primary)") {{ perm }}
      
      v-divider.tw-my-8
      
      .page-subtitle.tw-mt-8 {{ $t('password') }}
      .page-subtitle-info.tw-mb-8 {{ $t('change_your_password') }}
      
      label.form-input-label {{ $t('new_password') }}
      v-text-field(v-model="form.password" label="******" autocomplete="new-password" :type="showNewPassword ? 'text' : 'password'" :append-icon="showNewPassword ? icons['mdiEye'] : icons['mdiEyeOff']" @click:append="showNewPassword = !showNewPassword" prepend-inner-icon="mdi-key-variant" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" required solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiKeyVariant'] }}

      label.form-input-label {{ $t('new_password_verify') }}
      v-text-field(v-model="form.password2" label="******" autocomplete="new-password-confirm" :type="showNewPasswordConfirm ? 'text' : 'password'" :append-icon="showNewPasswordConfirm ? icons['mdiEye'] : icons['mdiEyeOff']" @click:append="showNewPasswordConfirm = !showNewPasswordConfirm" prepend-inner-icon="mdi-key-variant" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.newpassword2" required solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiKeyVariant'] }}
</template>

<script>
import { mdiAccount, mdiCheckBold, mdiEye, mdiEyeOff, mdiKeyVariant, mdiTimelapse } from '@mdi/js';

import { changeUser } from '@/api/users.api';

export default {
  name: 'AccountSettings',

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  data() {
    return {
      icons: {
        mdiAccount,
        mdiCheckBold,
        mdiEye,
        mdiEyeOff,
        mdiKeyVariant,
        mdiTimelapse,
      },

      fab: true,
      fabAbove: false,

      loading: false,
      loadingProgress: false,

      avatarSrc: '',

      form: {},

      rules: {
        username: [],
        newpassword: [],
        newpassword2: [],
      },

      sessionTimerSelect: [1, 4, 6, 9, 12, 24, this.$t('never')],

      showNewPassword: false,
      showNewPasswordConfirm: false,

      valid: true,
    };
  },

  computed: {
    currentUser() {
      return this.$store.state.auth.user || {};
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
  },

  created() {
    this.form = {
      username: this.currentUser.username,
      sessionTimer: this.currentUser.sessionTimer,
    };

    this.rules = {
      username: [(v) => (!!v && !!v.trim()) || this.$t('username_is_required')],
      newpassword2: [
        (v) =>
          v
            ? v === this.form.password || this.$t('password_not_match')
            : !this.form.password || this.$t('enter_new_password'),
      ],
    };

    if (this.currentUser.photo && this.currentUser.photo !== 'no_img.png') {
      this.avatarSrc = `/files/${this.currentUser.photo}`;
    } else {
      this.avatarSrc = require('../../../assets/img/no_user.png');
    }
  },

  methods: {
    async changeProfileImg(event) {
      try {
        const file = event.target.files[0];

        const formData = new FormData();
        formData.append('photo', file);

        await changeUser(this.currentUser.username, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        this.$store.dispatch('auth/updateUserImg', `photo_${this.currentUser.id}_${file.name}`);
        this.$toast.success(this.$t('successfully_changed'));
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    handleErrorImg() {
      this.avatarSrc = require('../../../assets/img/no_user.png');
    },
    onScroll(e) {
      if (typeof window === 'undefined') {
        this.fabAbove = true;
        return;
      }

      const top = window.pageYOffset || e.target.scrollTop || 0;
      this.fabAbove = top > 20;
    },
    reset() {
      this.form = { ...this.currentUser };
    },
    async save() {
      this.loadingProgress = true;

      const valid = this.$refs.form.validate();

      if (valid) {
        this.form.sessionTimer = this.$refs.sessionTimer.internalValue * 3600 || 2628000;

        if (this.form.password && this.form.password2) {
          delete this.form.password2;
        } else {
          delete this.form.password;
          delete this.form.password2;
        }

        try {
          await changeUser(this.currentUser.username, this.form);
          this.$toast.success(this.$t('successfully_changed'));

          await this.$store.dispatch('auth/logout');
          setTimeout(() => this.$router.push('/'), 200);
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }
      } else {
        this.$toast.warning(this.$t('fill_all_required_fields'));
      }

      this.loadingProgress = false;
    },
  },
};
</script>

<style scoped>
.image-upload label {
  cursor: pointer;
}

.image-upload > input {
  display: none;
}

.profile-avatar {
  width: 8rem;
  height: 8rem;
  border-radius: 4rem;
  overflow: hidden;
  object-fit: cover;
}

.profile-avatar-bg {
  border-radius: 5rem;
  border: 5px solid var(--trans-border-color);
}

.save-btn {
  right: 30px !important;
  bottom: 45px !important;
  z-index: 11 !important;
  transition: 0.3s all;
}

.save-btn-top {
  bottom: 95px !important;
}
</style>
