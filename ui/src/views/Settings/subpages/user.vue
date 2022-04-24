<template lang="pug">
.tw-w-full.tw-mt-8
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-5.tw-mt-5(v-if="!loading")
    .page-subtitle {{ $t('new') }}
    .page-subtitle-info {{ $t('add_new_user') }}

    v-form.tw-w-full.tw-mt-4(ref="form" v-model="valid" lazy-validation)
      label.form-input-label {{ $t('username') }}
      v-text-field(v-model="form.username" :label="$t('username')" prepend-inner-icon="mdi-account" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.username" required solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiAccount'] }}

      label.form-input-label {{ $t('password') }}
      v-text-field(v-model="form.password" label="******" prepend-inner-icon="mdi-key-variant" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.password" required solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiKeyVariant'] }}

      label.form-input-label {{ $t('permission') }}
      v-select(small-chips multiple v-model="form.permission" label="..." prepend-inner-icon="mdi-security" :items="permissions" background-color="var(--cui-bg-card)" :rules="rules.permission" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiSecurity'] }}

      v-btn.tw-mt-3.tw-text-white(:loading="loadingAdd" @click="add" block color="success") {{ $t('add') }}

    v-divider.tw-my-8

    .page-subtitle {{ $t('user_list') }}
    .page-subtitle-info {{ $t('list_of_existing_user') }}

    .tw-mt-4.tw-mb-8(v-for="(user,i) in users" :key="user.username" v-if="users.length > 1 && !user.permissionLevel.includes('admin')")
        
      label.form-input-label {{ $t('username') }}
      v-text-field(disabled :value="user.username" prepend-inner-icon="mdi-account" append-outer-icon="mdi-close-thick" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiAccount'] }}
        template(v-slot:append-outer)
          v-icon.tw-cursor-pointer(@click="remove(user, i)" color="error") {{ icons['mdiCloseThick'] }}

      label.form-input-label {{ $t('permissions') }}:
      v-chip.tw-text-white.tw-ml-1(small v-for="perm in user.permissionLevel" :key="perm" color="var(--cui-primary)") {{ perm }}

      v-divider.tw-mt-4.tw-mb-8(v-if="i !== users.length - 1")

    .tw-w-full.tw-text-center.tw-mt-5(v-if="users.length <= 1")
      span.text-muted {{ $t('no_registered_user') }}

</template>

<script>
import { mdiAccount, mdiCloseThick, mdiKeyVariant, mdiSecurity } from '@mdi/js';

import { addUser, getUsers, removeUser } from '@/api/users.api';

export default {
  name: 'UserSettings',

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data() {
    return {
      icons: { mdiAccount, mdiCloseThick, mdiKeyVariant, mdiSecurity },

      loading: true,
      loadingProgress: true,
      loadingAdd: false,

      users: [],

      form: {
        username: '',
        password: '',
        permission: [],
      },

      rules: {
        username: [],
        password: [],
        permission: [],
      },

      permissions: [
        {
          text: this.$t('base'),
          value: [
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
          text: this.$t('admin'),
          value: [
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
            //'settings:system:access',
            //'settings:system:edit',
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
            //'system:access',
            //'system:edit',
            'users:access',
            //'users:edit',
          ],
        },
        {
          text: this.$t('backup'),
          value: ['backup:download', 'backup:restore'],
        },
        {
          text: this.$t('cameras'),
          value: ['cameras:access', 'cameras:edit', 'settings:cameras:access'],
        },
        {
          text: this.$t('camview'),
          value: ['cameras:access', 'camview:access', 'settings:cameras:access'],
        },
        /*{
          text: this.$t('system'),
          value: ['system:access', 'system:edit', 'settings:system:access'],
        },
        {
          text: this.$t('system'),
          value: ['system:access'],
        },*/
        {
          text: this.$t('dashboard'),
          value: ['cameras:access', 'dashboard:access', 'settings:cameras:access'],
        },
        {
          text: this.$t('notifications'),
          value: ['notifications:access', 'notifications:edit'],
        },
        {
          text: this.$t('recordings'),
          value: ['recordings:access', 'recordings:edit'],
        },
        {
          text: `${this.$t('settings')} ${this.$t('user')}`,
          value: ['settings:access', 'settings:general:access', 'settings:profile:access'],
        },
        {
          text: `${this.$t('settings')} ${this.$t('admin')}`,
          value: [
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

      valid: true,
    };
  },

  async created() {
    try {
      const users = await getUsers();
      this.users = users.data.result;

      this.rules = {
        username: [
          (v) => {
            if (!v || !v.trim()) {
              return this.$t('username_is_required');
            } else if (this.users.some((user) => user.username === v)) {
              return this.$t('username_already_exists');
            }

            return true;
          },
        ],
        password: [(v) => (!!v && !!v.trim()) || this.$t('password_is_required')],
        permission: [(v) => v.length > 0 || this.$t('atleast_one_permission_required')],
      };

      this.loading = false;
      this.loadingProgress = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  methods: {
    async add() {
      if (this.loadingAdd) {
        return;
      }

      this.loadingAdd = true;
      this.loadingProgress = true;

      const valid = this.$refs.form.validate();

      if (valid) {
        const user = await addUser({
          username: this.form.username,
          password: this.form.password,
          permissionLevel: [...new Set(this.form.permission.flat())],
        });

        this.users.push(user.data);

        this.$refs.form.reset();
        this.$toast.success('New user added');
      }

      this.loadingAdd = false;
      this.loadingProgress = false;
    },
    async remove(user, index) {
      this.loadingProgress = true;

      try {
        await removeUser(user.username);
        this.users.splice(index, 1);
        this.$toast.success(this.$t('successfully_removed'));
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingProgress = false;
    },
  },
};
</script>

<style scoped>
div >>> .v-chip .v-chip__content {
  color: #fff !important;
}
</style>
