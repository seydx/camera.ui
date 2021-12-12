<template lang="pug">
.tw-w-full.tw-mt-8
  v-progress-linear.loader(:active="loading" :indeterminate="loading" fixed top color="var(--cui-primary)")

  .tw-flex.tw-justify-between
    .tw-block
      .page-subtitle {{ $t('profile') }}
      .page-subtitle-info {{ $t('general_information') }}
    .image-upload.tw-ml-auto
      label.profile-avatar-bg(for='file-input')
        v-img.profile-avatar(v-on:error="handleErrorImg" :src="avatarSrc" alt="Avatar" width="4rem" height="4rem" style="border: 1px solid #1a1a1a")
      input#file-input(type="file", name="photo", placeholder="Photo", required="", accept="image/png,image/jpeg", @change="changeProfileImg")

  v-form.tw-w-full.tw-mt-4.tw-mb-8(ref="form" v-model="valid" lazy-validation)
    label.form-input-label {{ $t('username') }}
    v-text-field(v-model="form.username" :label="$t('username')" prepend-inner-icon="mdi-account" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.username" required solo)

    label.form-input-label {{ $t('signout_after') }}
    v-select(ref="sessionTimer" :suffix="$t('hours')" :value="form.sessionTimer/3600 > 25 ? $t('never') : form.sessionTimer/3600" :items="sessionTimerSelect" prepend-inner-icon="mdi-timelapse" background-color="var(--cui-bg-card)" required solo)
    
    label.form-input-label {{ $t('permissions') }}: 
    v-chip.tw-text-white.tw-ml-1(small v-for="perm in currentUser.permissionLevel" :key="perm" color="var(--cui-primary)") {{ perm }}
    
    v-divider.tw-my-8
    
    .page-subtitle.tw-mt-8 {{ $t('password') }}
    .page-subtitle-info.tw-mb-8 {{ $t('change_your_password') }}
    
    label.form-input-label {{ $t('new_password') }}
    v-text-field(v-model="form.password" label="******" autocomplete="new-password" :type="showNewPassword ? 'text' : 'password'" :append-icon="showNewPassword ? 'mdi-eye' : 'mdi-eye-off'" @click:append="showNewPassword = !showNewPassword" prepend-inner-icon="mdi-key-variant" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" required solo)

    label.form-input-label {{ $t('new_password_verify') }}
    v-text-field(v-model="form.password2" label="******" autocomplete="new-password-confirm" :type="showNewPasswordConfirm ? 'text' : 'password'" :append-icon="showNewPasswordConfirm ? 'mdi-eye' : 'mdi-eye-off'" @click:append="showNewPasswordConfirm = !showNewPasswordConfirm" prepend-inner-icon="mdi-key-variant" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.newpassword2" required solo)

    v-divider.tw-mt-4.tw-mb-8

    .tw-flex.tw-justify-end.tw-mt-5
      v-btn.tw-mr-2.tw-text-white.tw-text-xs.tw-font-semibold(@click="reset" color="var(--cui-text-hint)" rounded depressed) {{ $t('cancel') }}
      v-btn.tw-text-white.tw-text-xs.tw-font-semibold(@click="save" color="var(--cui-primary)" rounded depressed) {{ $t('save') }}

</template>

<script>
import { changeUser } from '@/api/users.api';

export default {
  name: 'AccountSettings',

  data() {
    return {
      loading: false,

      avatarSrc: '@/assets/img/no_user.png',

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

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
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
      this.avatarSrc = require('@/assets/img/no_user.png');
    },
    reset() {
      this.form = { ...this.currentUser };
    },
    async save() {
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
</style>
