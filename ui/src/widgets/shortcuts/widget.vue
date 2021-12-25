<template lang="pug">
.content.tw-overflow-y-hidden
  .tw-text-xs.tw-absolute.tw-top-2.tw-left-2.tw-font-bold.text-muted {{ $t('shortcuts') }}

  .tw-absolute.tw-right-2.tw-top-2.tw-z-10
    v-btn.text-muted(icon x-small @click="dialog = true")
      v-icon {{ icons['mdiCog'] }}

  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-else-if="!shortcutButtons.length")
    v-btn(fab small depressed @click="dialog = true" color="var(--cui-text-hint)")
      v-icon.text-default {{ icons['mdiPlusThick'] }}
  
  .tw-h-full.tw-w-full.tw-overflow-x-auto
    .tw-h-full.tw-p-4.tw-relative.tw-flex.tw-items-center.tw-justify-start(v-if="!loading && shortcutButtons.length")
      v-btn.shortcut-btn.tw-flex.tw-items-center.tw-justify-center.tw-mx-1(v-for="button in shortcutButtons" :key="button.id" @click="clickShortcut(button)" :class="states[button.id] ? button.onClass ? button.onClass : '' : button.offClass ? button.offClass : ''")
        v-icon.text-default(size="20") {{ icons[button.icon] }}

  v-dialog(v-model="dialog" width="400" scrollable)
    v-card(height="400")
      v-card-title {{ $t('shortcuts') }}
      v-divider
      v-card-text.tw-p-7.tw-flex.tw-flex-col.tw-items-center.tw-justify-center
        .tw-block(v-if="loadingDialog")
          v-progress-circular(indeterminate color="var(--cui-primary)" size="20")

        .tw-w-full(v-else)
          v-sheet.tw-p-3(rounded class="mx-auto" width="100%" color="rgba(0,0,0,0.2)")
            span.text-default {{ $t('shortcuts_widget_info') }}
            
          .tw-w-full.tw-mt-5
            label.text-default {{ $t('shortcuts') }}
            v-select(small-chips deletable-chips multiple v-model="selectedShortcutButtons" label="..." prepend-inner-icon="mdi-widgets-outline" :items="availableShortcuts" item-text="name" item-value="id" background-color="var(--cui-bg-card)" solo)
              template(v-slot:prepend-inner)
                v-icon.text-muted {{ icons['mdiWidgetsOutline'] }}

      v-divider
      v-card-actions.tw-flex.tw-justify-end
        v-btn.text-default(text @click='dialog = false') {{ $t('cancel') }}
        v-btn(color='var(--cui-primary)' text @click='applyData') {{ $t('apply') }}
      
</template>

<script>
/* eslint-disable vue/require-default-prop */
import {
  mdiAccount,
  mdiCog,
  mdiHome,
  mdiLogoutVariant,
  mdiPlusThick,
  mdiPower,
  mdiReload,
  mdiWidgetsOutline,
} from '@mdi/js';

import { restartSystem } from '@/api/system.api';
import { getSetting, changeSetting } from '@/api/settings.api';

export default {
  name: 'ShortcutsWidget',

  props: {
    item: Object,
  },

  data() {
    return {
      loading: true,
      loadingDialog: false,

      dialog: null,

      icons: {
        mdiAccount,
        mdiCog,
        mdiHome,
        mdiLogoutVariant,
        mdiPlusThick,
        mdiPower,
        mdiReload,
        mdiWidgetsOutline,
      },

      selectedShortcutButtons: [],
      shortcutButtons: [],
      availableShortcuts: [
        {
          id: 'Account',
          name: this.$t('account'),
          icon: 'mdiAccount',
          goTo: '/settings/account',
        },
        {
          id: 'At Home',
          name: this.$t('at_home'),
          icon: 'mdiHome',
          set: 'atHome',
          get: 'atHome',
          onClass: 'athome-on',
          offClass: 'athome-off',
        },
        {
          id: 'Reload',
          name: this.$t('reload'),
          icon: 'mdiReload',
          set: 'reload',
        },
        {
          id: 'Sign Out',
          name: this.$t('signout'),
          icon: 'mdiLogoutVariant',
          set: 'singout',
        },
        {
          id: 'Restart',
          name: this.$t('restart'),
          icon: 'mdiPower',
          set: 'restart',
        },
      ],

      states: {},

      getters: {
        atHome: async () => {
          if (this.states['At Home'] === undefined) {
            this.$set(this.states, 'At Home', false);
          }

          try {
            const general = await getSetting('general');
            const generalData = general.data;

            this.states['At Home'] = generalData.atHome;
          } catch {
            //ignore
          }
        },
      },

      setters: {
        atHome: async () => {
          const state = !this.states['At Home'];

          try {
            await changeSetting('general', {
              atHome: state,
            });

            this.states['At Home'] = state;
          } catch (err) {
            console.log(err);
            this.$toast.error(err.message);
          }
        },
        reload: () => {
          window.location.reload(true);
        },
        restart: async () => {
          try {
            await restartSystem();
            localStorage.setItem('restarted', true);
          } catch (err) {
            console.log(err);
            this.$toast.error(err.message);
          }
        },
        signout: async () => {
          await this.$store.dispatch('auth/logout');
          setTimeout(() => this.$router.push('/'), 200);
        },
      },
    };
  },

  watch: {
    '$route.path': {
      handler() {
        this.dialog = false;
      },
    },
  },

  async mounted() {
    try {
      const widgets = await getSetting('widgets');
      const items = widgets.data.items;

      const shortcutsWidget = items.find((item) => item.id === this.item.id);

      if (shortcutsWidget?.buttons?.length) {
        this.selectedShortcutButtons = shortcutsWidget.buttons;
        this.shortcutButtons = this.availableShortcuts.filter((shortcut) =>
          this.selectedShortcutButtons.some((selectedShortcut) => selectedShortcut === shortcut.id)
        );
      }

      this.shortcutButtons.forEach((shortcut) => {
        if (shortcut.get) {
          if (!this.getters[shortcut.get]) {
            return this.$toast.error(`${shortcut.name}: ${this.$t('error')} (GET)`);
          }

          this.getters[shortcut.get]();
        }
      });

      this.loading = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {},

  methods: {
    async applyData() {
      this.loadingDialog = true;

      this.$emit('widgetData', {
        id: this.item.id,
        data: {
          buttons: this.selectedShortcutButtons,
        },
      });

      this.shortcutButtons = this.availableShortcuts.filter((shortcut) =>
        this.selectedShortcutButtons.some((selectedShortcut) => selectedShortcut === shortcut.id)
      );

      this.shortcutButtons.forEach((shortcut) => {
        if (shortcut.get) {
          if (!this.getters[shortcut.get]) {
            return this.$toast.error(`${shortcut.name}: ${this.$t('error')} (GET)`);
          }

          this.getters[shortcut.get]();
        }
      });

      this.dialog = false;
      this.loadingDialog = false;
    },
    clickShortcut(button) {
      try {
        if (button.set) {
          if (!this.setters[button.set]) {
            return this.$toast.error(`${button.name}: ${this.$t('error')} (SET)`);
          }

          this.setters[button.set]();
        } else if (button.goTo) {
          this.$router.push(button.goTo);
        } else {
          this.$toast.error(`${button.name}: ${this.$t('error')} (ACTION)`);
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  min-height: 100px;
  background: var(--cui-bg-default);
  border-radius: 10px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
}

.widget {
}

.shortcut-btn {
  height: 50px !important;
  width: 50px !important;
  background: var(--cui-bg-card) !important;
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5) !important;
  border-radius: 13px !important;
  box-shadow: 0px 0px 15px -3px rgba(0, 0, 0, 0.3) !important;
}

div >>> .v-chip .v-chip__content {
  color: #fff !important;
}

.athome-on {
  background: var(--cui-primary) !important;
}
</style>
