<template lang="pug">
.w-100.h-100
  .d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
    b-spinner.text-color-primary
  transition-group(name="fade", mode="out-in", v-if="loading")
  transition-group(name="fade", mode="out-in", v-else)
    .d-flex.flex-wrap.justify-content-between(key="loaded", v-if="currentUser")
      .col-12.col-md.mb-5(data-aos="fade-up" data-aos-duration="1000")
        .settings-box.d-flex.flex-wrap.justify-content-center.align-content-center.container
          .image-upload
            label.profile-avatar-bg(for='file-input')
              b-card-img-lazy.profile-avatar(@error.native="handleErrorImg" :src="currentUser.photo !== 'no_img.png' ? '/files/' + currentUser.photo : '@/assets/img/no_user.png'" alt="Avatar" width="8rem" height="8rem")
            input#file-input(type="file", name="photo", placeholder="Photo", required="", accept="image/png,image/jpeg", @change="changeProfileImg")
          .w-100.my-2
          h5.font-weight-bold.lh-1 {{ currentUser.username }}
          .w-100
          span.text-color-primary.fs-7.lh-1.m-0 {{ currentUser.permissionLevel.includes("admin") ? $t("master") : $t("user") }}
        .btn.btn-danger.mt-2.w-100.p-2.mt-3(v-if="checkLevel('admin')", v-b-modal.modal-reset) {{ $t("reset") }}
        .settings-box.container.mt-5(v-if="checkLevel('admin')")
          h3.lh-1.font-weight-bold {{ $t("backup") }}
          .w-100
          span.lh-1.text-muted-2.fs-6 {{ $t("backup_and_restore") }}
          hr.hr-underline.mb-4
          b-form-file(
            id="backup-file", 
            :placeholder="$t('backup')",
            :browse-text="$t('browse')",
            :drop-placeholder="$t('drop_files_here')",
            size="sm",
            accept=".gz",
            ref="file-input-backup"
          )
          .w-100.my-2
          .btn.btn-success.mt-2.w-100.p-2.mt-3(
            @click="restoreBackup"
          ) 
            span.text-white.mr-2(v-show='uploadBackupSpinner')
              b-spinner(small type='grow')
            | {{ $t("backup_restore") }}
          .btn.btn-danger.mt-2.w-100.p-2.mt-3(
            @click="downloadBackup"
          ) 
            span.text-white.mr-2(v-show='downloadBackupSpinner')
              b-spinner(small type='grow')
            | {{ $t("backup_download") }}
        b-modal#modal-reset(
          centered
          no-close-on-backdrop
          no-close-on-esc
          ref="reset-modal"
          :title="$t('reset_confirm')",
          :cancel-title="$t('cancel')",
          :ok-title="$t('reset')",
          ok-variant="danger",
          @ok="reset"
        )
          b-overlay(
            variant="transparent"
            :show="resetLoading"
            rounded="sm"
          )
            p.my-4 {{ $t('reset_confirm_text') }}
      .col-12.col-md-8(data-aos="fade-up" data-aos-duration="1000")
        .settings-box.container
          h3.lh-1.font-weight-bold {{ $t("account") }}
          .w-100
          span.lh-1.text-muted-2.fs-6 {{ $t("general_information") }}
          hr.hr-underline.mb-4
          label.fs-6 {{ $t("username") }}
          b-form-input.admin-username(
            type='text',
            :value="currentUser.username"
            :placeholder="$t('username')"
          )
          .w-100.my-3
          label.fs-6 {{ $t("new_password") }}
          b-form-input.admin-newpw(
            type='text',
            placeholder="********"
          )
          .w-100.my-3
          label.fs-6 {{ $t("new_password_verify") }}
          b-form-input.admin-newpw-verify(
            type='text',
            placeholder="********"
          )
          .w-100.my-3
          label.fs-6 {{ $t("signout_after") }}
          b-form-select.admin-sessiontimer(
            :value="currentUser.sessionTimer/3600 > 25 ? $t('never') : currentUser.sessionTimer/3600"
            :options="sessionTimerSelect"
          )
          .btn.btn-success.mt-4.w-100(@click="changeAdmin") {{ $t("apply") }}
        .settings-box.container.mt-5(v-if="currentUser.permissionLevel.includes('admin')")
          h3.lh-1.font-weight-bold {{ $t("user") }}
          .w-100
          span.lh-1.text-muted-2.fs-6 {{ $t("registered_user") }}
          hr.hr-underline.mb-4
          h5 {{ $t("add_new_user") }}
          .w-100.my-4
          label.fs-6 {{ $t("username") }}
          b-form-input(
            type='text',
            :placeholder="$t('username')"
            v-model="form.newUser.username"
            :state="newUserNameState",
            lazy
          )
          .w-100.my-3
          label.fs-6 {{ $t("password") }}
          b-form-input(
            type='text',
            placeholder="********"
            v-model="form.newUser.password",
            :state="newUserPasswordState",
            lazy
          )
          .w-100.my-3
          label.fs-6 {{ $t("permissions") }}
          multiselect(
            v-model="form.newUser.permissionLevel",
            :options="permissions",
            :searchable="false",
            :close-on-select="false",
            :show-labels="false"
            :placeholder="$t('select')",
            :multiple="true",
            :limit="2",
            group-values="permissionLevel",
            group-label="catagory",
            :group-select="true",
            :tabindex="99",
            openDirection="top"
          )
          .btn.btn-success.mt-4.w-100(@click="addUser()") {{ $t("add") }}
          hr.hr-underline
          b-icon.showHideUser(icon="plus-circle-fill", @click="showUser = !showUser", v-if="!showUser && users.length > 1")
          b-icon.showHideUser(icon="dash-circle-fill", @click="showUser = !showUser", v-if="showUser && users.length > 1")
          h5 {{ $t("registered_user") }}
          div.z-index-2(v-if="users.length > 1")
            b-collapse(
              v-model="showUser"
            )
              div(v-for="(user, index) in users" data-aos="fade-up" data-aos-duration="1000")
                div.mt-4(v-if="!user.permissionLevel.includes('admin')")
                  label.fs-6 {{ $t("username") }}
                  b-form-input.users(
                    type='text',
                    :placeholder="$t('username')"
                    :value="user.username"
                  )
                  .w-100.my-3
                  label.fs-6 {{ $t("permissions") }}
                  multiselect(
                    v-model="user.permissionLevel",
                    :options="permissions",
                    :searchable="false",
                    :close-on-select="false",
                    :show-labels="false"
                    :placeholder="$t('select')",
                    :multiple="true",
                    :limit="2"
                    :allow-empty="false",
                    group-values="permissionLevel",
                    group-label="catagory",
                    :group-select="true",
                    openDirection="top"
                  )
                  .row
                    .col
                      .btn.btn-danger.mt-4.w-100(@click="removeUser(user, index)") {{ $t("remove") }}
                    .col
                      .btn.btn-success.mt-4.w-100(@click="changeUser(user, index)") {{ $t("apply") }}
                  hr.hr-underline
          div(v-else)
            p.mt-5.text-center {{ $t("no_registered_user") }}
</template>

<script>
import { BIcon, BIconDashCircleFill, BIconPlusCircleFill } from 'bootstrap-vue';
import Multiselect from 'vue-multiselect';
import 'vue-multiselect/dist/vue-multiselect.min.css';

import { downloadBackup, restoreBackup } from '@/api/backup.api';
import { resetSettings } from '@/api/settings.api';
import { addUser, changeUser, getUsers, removeUser } from '@/api/users.api';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'SettingsProfile',
  components: {
    BIcon,
    BIconDashCircleFill,
    BIconPlusCircleFill,
    Multiselect,
  },
  data() {
    return {
      form: {
        avatar: null,
        newUser: {
          username: '',
          password: '',
          permissionLevel: [],
        },
      },
      permissions: [
        {
          catagory: this.$t('base'),
          permissionLevel: [
            'cameras:access',
            'camview:access',
            'dashboard:access',
            'notifications:access',
            'recordings:access',
            'settings:access',
            'settings:cameras:access',
            'settings:camview:access',
            'settings:dashboard:access',
            'settings:general:access',
            'settings:profile:access',
          ],
        },
        {
          catagory: this.$t('admin'),
          permissionLevel: [
            'backup:download',
            'backup:restore',
            'cameras:access',
            'cameras:edit',
            'camview:access',
            'dashboard:access',
            'notifications:access',
            'notifications:edit',
            'recordings:access',
            'recordings:edit',
            'settings:access',
            'settings:edit',
            'settings:cameras:access',
            'settings:cameras:edit',
            'settings:camview:access',
            'settings:camview:edit',
            'settings:dashboard:access',
            'settings:dashboard:edit',
            'settings:general:access',
            'settings:general:edit',
            'settings:notifications:access',
            'settings:notifications:edit',
            'settings:profile:access',
            'settings:profile:edit',
            'settings:recordings:access',
            'settings:recordings:edit',
            'users:access',
          ],
        },
        {
          catagory: this.$t('backup'),
          permissionLevel: ['backup:download', 'backup:restore'],
        },
        {
          catagory: this.$t('cameras'),
          permissionLevel: ['cameras:access', 'cameras:edit', 'settings:cameras:access'],
        },
        {
          catagory: this.$t('camview'),
          permissionLevel: ['cameras:access', 'camview:access', 'settings:cameras:access'],
        },
        {
          catagory: this.$t('config'),
          permissionLevel: ['config:access'],
        },
        {
          catagory: this.$t('dashboard'),
          permissionLevel: ['cameras:access', 'dashboard:access', 'settings:cameras:access'],
        },
        {
          catagory: this.$t('notifications'),
          permissionLevel: ['notifications:access', 'notifications:edit'],
        },
        {
          catagory: this.$t('recordings'),
          permissionLevel: ['recordings:access', 'recordings:edit'],
        },
        {
          catagory: `${this.$t('settings')} ${this.$t('user')}`,
          permissionLevel: ['settings:access', 'settings:general:access', 'settings:profile:access'],
        },
        {
          catagory: `${this.$t('settings')} ${this.$t('admin')}`,
          permissionLevel: [
            'settings:access',
            'settings:edit',
            'settings:cameras:access',
            'settings:cameras:edit',
            'settings:camview:access',
            'settings:camview:edit',
            'settings:dashboard:access',
            'settings:dashboard:edit',
            'settings:general:access',
            'settings:general:edit',
            'settings:notifications:access',
            'settings:notifications:edit',
            'settings:profile:access',
            'settings:profile:edit',
            'settings:recordings:access',
            'settings:recordings:edit',
          ],
        },
      ],
      showUser: false,
      sessionTimerSelect: [1, 4, 6, 9, 12, 24, this.$t('never')],
      downloadBackupSpinner: false,
      uploadBackupSpinner: false,
      users: [],
      loading: true,
      resetLoading: false,
    };
  },
  computed: {
    currentUser() {
      return this.$store.state.auth.user;
    },
    newUserNameState() {
      const state =
        this.form.newUser.username.length > 0
          ? !this.users.some((user) => user && user.username == this.form.newUser.username)
            ? true
            : false
          : null;
      return state;
    },
    newUserPasswordState() {
      const state = this.form.newUser.password.length > 0 ? true : null;
      return state;
    },
    newUserPermissionLevelState() {
      const state = this.form.newUser.permissionLevel.length > 0 ? true : false;
      return state;
    },
  },
  async mounted() {
    try {
      if (this.checkLevel('users:access')) {
        const users = await getUsers();
        this.users = users.data.result;
      }
      this.loading = false;
    } catch (err) {
      this.$toast.error(err.message);
    }
  },
  methods: {
    async addUser() {
      try {
        if (this.newUserNameState && this.newUserPasswordState && this.newUserPermissionLevelState) {
          const user = await addUser({
            username: this.form.newUser.username,
            password: this.form.newUser.password,
            permissionLevel: this.form.newUser.permissionLevel,
          });

          this.users.push(user.data);

          this.$toast.success(this.$t('successfully_created'));
          this.form.newUser = {
            username: '',
            password: '',
            permissionLevel: '',
          };
        } else {
          if (!this.newUserNameState) this.$toast.error(this.$t('no_username_defined'));
          else if (!this.newUserPasswordState) this.$toast.error(this.$t('no_password_defined'));
          else if (!this.newUserPermissionLevelState) this.$toast.error(this.$t('no_permissionlevel_defined'));
        }
      } catch (err) {
        this.$toast.error(err.message);
      }
    },
    async changeAdmin() {
      const usernameValue = document.querySelector('.admin-username').value;
      const newpwValue = document.querySelector('.admin-newpw').value;
      const newpwVerifyValue = document.querySelector('.admin-newpw-verify').value;

      const sessionInput = !Number.isNaN(Number.parseInt(document.querySelector('.admin-sessiontimer').value));
      const sessionTimer = sessionInput ? document.querySelector('.admin-sessiontimer').value * 3600 : 2628000;

      if (!usernameValue || usernameValue === '') {
        return this.$toast.error(this.$t('no_username_defined'));
      } else if (newpwValue && newpwValue !== '') {
        if ((!newpwVerifyValue || newpwVerifyValue !== '') && newpwValue !== newpwVerifyValue) {
          return this.$toast.error(`${this.$t('cannot_change_pw')}. ${this.$t('verification_not_successfull')}`);
        }
      } else if (newpwVerifyValue && newpwVerifyValue !== '' && (!newpwValue || newpwValue !== '')) {
        return this.$toast.error(`${this.$t('cannot_change_pw')}. ${this.$t('no_password_defined')}`);
      }

      const adminData = {};

      if (usernameValue !== this.currentUser.username) {
        adminData.username = usernameValue;
      }
      if (newpwValue && newpwValue !== '') {
        adminData.password = newpwValue;
      }
      if (sessionTimer !== this.currentUser.sessionTimer) {
        adminData.sessionTimer = sessionTimer;
      }

      try {
        await changeUser(this.currentUser.username, adminData);
        this.$toast.success(this.$t('successfully_changed'));

        await this.$store.dispatch('auth/logout');
        this.$router.push('/');
      } catch (error) {
        this.$toast.error(error.message);
      }
    },
    async changeUser(user, index) {
      const userValue = document.querySelectorAll('.users')[index - 1].value;

      if (!userValue || userValue === '') {
        return this.$toast.error(this.$t('no_username_defined'));
      } else if (user.permissionLevel.length === 0) {
        return this.$toast.error(`${userValue}: ${this.$t('no_permissionlevel_defined')}`);
      }

      const userData = {
        permissionLevel: user.permissionLevel,
      };

      if (userValue !== user.username) {
        userData.username = userValue;
      }

      try {
        await changeUser(user.username, userData);
        this.$toast.success(this.$t('successfully_changed'));
      } catch (error) {
        this.$toast.error(error.message);
      }
    },
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
        this.$toast.error(err.message);
      }
    },
    async downloadBackup() {
      try {
        this.downloadBackupSpinner = true;
        const userStorage = {
          camviewLayout: localStorage.getItem('camview-layouts'),
          dashboardLayout: localStorage.getItem('dashboard-layout'),
          theme: localStorage.getItem('theme'),
          themeColor: localStorage.getItem('theme-color'),
        };
        const response = await downloadBackup(JSON.stringify(userStorage));
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'cameraui-backup.tar.gz');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err) {
        this.$toast.error(err.message);
      }
      this.downloadBackupSpinner = false;
    },
    async restoreBackup() {
      try {
        const file = document.getElementById('backup-file').files[0];

        if (file) {
          this.uploadBackupSpinner = true;
          const formData = new FormData();
          formData.append('file', file);

          const userStorage = await restoreBackup(formData);
          this.restoreLocalStorage(userStorage.data);

          this.$refs['file-input-backup'].reset();
          this.$toast.success(this.$t('backup_restored'));

          await this.$store.dispatch('auth/logout');
          this.$router.push('/');
          window.location.reload(true);
        } else {
          this.$toast.error(this.$t('no_file_selected'));
        }
      } catch (err) {
        this.$toast.error(err.message);
      }
      this.uploadBackupSpinner = false;
    },
    restoreLocalStorage(storage) {
      if (storage.camviewLayout) {
        localStorage.setItem('camview-layouts', JSON.stringify(storage.camviewLayout));
      }
      if (storage.dashboardLayout) {
        localStorage.setItem('dashboard-layout', JSON.stringify(storage.dashboardLayout));
      }
      if (storage.theme) {
        localStorage.setItem('theme', storage.theme);
      }
      if (storage.themeColor) {
        localStorage.setItem('theme-color', storage.themeColor);

        const images = document.querySelectorAll('.theme-img');

        for (const img of images) {
          let imgSource = img.src;
          imgSource = imgSource.split('/');
          imgSource = imgSource[imgSource.length - 1].split('.png')[0].split('.')[0].split('@')[0];
          img.src = require(`@/assets/img/${imgSource}@${storage.themeColor}.png`);
        }
      }
    },
    handleErrorImg(event) {
      event.target.src = require('@/assets/img/no_user.png');
    },
    async removeUser(user, index) {
      try {
        await removeUser(user.username);
        this.$toast.success(this.$t('successfully_removed'));
        this.$delete(this.users, index);
      } catch (err) {
        this.$toast.error(err.message);
      }
    },
    async reset(bvModalEvent) {
      try {
        bvModalEvent.preventDefault();

        this.resetLoading = true;
        await timeout(3000);

        try {
          await resetSettings();
          this.$toast.success(this.$t('database_resetted'));
          this.$refs['reset-modal'].hide();

          await this.$store.dispatch('auth/logout');
          this.$router.push('/');
        } catch (error) {
          this.$toast.error(error.message);
        }

        this.resetLoading = false;
      } catch (err) {
        this.$toast.error(err.message);
      }
    },
  },
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease-out;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

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

div >>> .custom-file-label {
  background: var(--third-bg-color) !important;
  border-color: var(--fourth-bg-color) !important;
  color: #737373 !important;
}

div >>> .border-bottom-shadow-danger {
  border-bottom: 3px solid #8c1e20 !important;
}

div >>> .border-bottom-shadow-primary {
  border-bottom: 3px solid var(--third-color) !important;
}

div >>> .border-bottom-shadow-success {
  border-bottom: 3px solid #137d1d !important;
}

.custom-file {
  cursor: pointer;
}

.showHideUser {
  float: right;
  margin-top: 5px;
  color: var(--primary-color);
  cursor: pointer;
}
</style>
