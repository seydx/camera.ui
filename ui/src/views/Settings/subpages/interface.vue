<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-7.tw-mt-5(v-if="!loading")
    .page-subtitle {{ $t('general') }}
    .page-subtitle-info {{ $t('general_settings') }}

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('at_home') }}
      v-switch(:disabled="general.automation.active" color="var(--cui-primary)" v-model="general.atHome" @change="function(){restartAutomation = false; stopAutomation = true;}")

    label.form-input-label {{ $t('exclude') }}
    v-select.select(:placeholder="$t('exclude')" prepend-inner-icon="mdi-cctv" small-chips deletable-chips v-model="general.exclude" :items="cameras" item-text="name" :disabled="!general.atHome || general.automation.active" background-color="var(--cui-bg-card)" solo multiple @change="function(){restartAutomation = false; stopAutomation = true;}")
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiCctv'] }}

    v-divider.tw-mt-4.tw-mb-8

    .page-subtitle-info.tw-mt-8 {{ $t('automation') }}

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="general.automation.active" @change="function(){restartAutomation = general.automation.active ? true : false; stopAutomation = general.automation.active ? false : true;}")

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('at_home') }}
      v-switch(color="var(--cui-primary)" v-model="general.automation.atHome" :disabled="!general.automation.active" @change="function(){restartAutomation = true; stopAutomation = false;}")

    label.form-input-label {{ $t('exclude') }}
    v-select.select(:placeholder="$t('exclude')" prepend-inner-icon="mdi-cctv" small-chips deletable-chips v-model="general.automation.exclude" :items="cameras" item-text="name" :disabled="!general.automation.atHome || !general.automation.active" background-color="var(--cui-bg-card)" solo multiple @change="function(){restartAutomation = true; stopAutomation = false;}")
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiCctv'] }}

    label.form-input-label {{ $t('from') }}
    v-dialog(ref="fromDialog" v-model="modalFrom" :return-value.sync="general.automation.startTime" width="290px")
      template(v-slot:activator="{ on, attrs }")
        v-text-field(solo v-model="general.automation.startTime" :disabled="!general.automation.active" prepend-inner-icon="mdi-clock-time-four-outline" readonly v-bind="attrs" v-on="on" @change="function(){restartAutomation = true; stopAutomation = false;}")
          template(v-slot:prepend-inner)
            v-icon.text-muted {{ icons['mdiClockTimeFourOutline'] }}
      v-time-picker(v-if="modalFrom" v-model="general.automation.startTime" format="24hr" full-width)
        v-spacer
        v-btn(text color="var(--cui-primary)" @click="modalFrom = false") {{ $t('cancel') }}
        v-btn(text color="var(--cui-primary)" @click="$refs.fromDialog.save(general.automation.startTime)") {{ $t('ok') }}

    label.form-input-label {{ $t('to') }}
    v-dialog(ref="toDialog" v-model="modalTo" :return-value.sync="general.automation.endTime" width="290px")
      template(v-slot:activator="{ on, attrs }")
        v-text-field(solo v-model="general.automation.endTime" :disabled="!general.automation.active" prepend-inner-icon="mdi-clock-time-four-outline" readonly v-bind="attrs" v-on="on" @change="function(){restartAutomation = true; stopAutomation = false;}")
          template(v-slot:prepend-inner)
            v-icon.text-muted {{ icons['mdiClockTimeFourOutline'] }}
      v-time-picker(v-if="modalTo" v-model="general.automation.endTime" format="24hr" full-width)
        v-spacer
        v-btn(text color="var(--cui-primary)" @click="modalTo = false") {{ $t('cancel') }}
        v-btn(text color="var(--cui-primary)" @click="$refs.toDialog.save(general.automation.endTime)") {{ $t('ok') }}

    v-divider.tw-mt-4.tw-mb-8

    .page-subtitle.tw-mt-8 {{ $t('rooms') }}
    .page-subtitle-info {{ $t('new_room') }}

    v-form.tw-w-full.tw-mt-8.tw-mb-3(ref="form" v-model="valid" lazy-validation @submit.prevent="addRoom")
      label.form-input-label {{ $t('name') }}
      v-text-field(v-model="roomName" :label="$t('room_name')" prepend-inner-icon="mdi-door" append-outer-icon="mdi-check-bold" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.room" required solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiDoor'] }}
        template(v-slot:append-outer)
          v-icon.tw-cursor-pointer(@click="addRoom" color="success") {{ icons['mdiCheckBold'] }}

    .page-subtitle-info.tw-mb-4 {{ $t('existing_rooms') }}

    .tw-w-full(v-for="(room,i) in general.rooms" :key="room")
      v-text-field(:value="room === 'Standard' ? $t('standard') : room" prepend-inner-icon="mdi-door" :append-outer-icon="room !== 'Standard' ? 'mdi-close-thick' : ''" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" readonly solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiDoor'] }}
        template(v-slot:append-outer v-if="room !== 'Standard'")
          v-icon.tw-cursor-pointer(@click="removeRoom(room,i)" color="error") {{ icons['mdiCloseThick'] }}

</template>

<script>
import { mdiCctv, mdiCheckBold, mdiClockTimeFourOutline, mdiCloseThick, mdiDoor } from '@mdi/js';

import { getSetting, changeSetting } from '@/api/settings.api';

export default {
  name: 'GeneralSettings',

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data: () => ({
    icons: { mdiCctv, mdiCheckBold, mdiClockTimeFourOutline, mdiCloseThick, mdiDoor },

    modalFrom: false,
    modalTo: false,

    loading: true,
    loadingProgress: true,

    cameras: [],
    general: {},
    generalTimeout: null,

    roomName: '',

    restartAutomation: false,
    stopAutomation: false,

    rules: {
      room: [],
    },

    valid: true,
  }),

  async created() {
    try {
      const general = await getSetting('general');
      this.general = general.data;

      const cameras = await getSetting('cameras');
      this.cameras = cameras.data;

      this.$watch('general', this.generalWatcher, { deep: true });

      this.rules = {
        room: [
          (v) => {
            if (!v || !v.trim()) {
              return this.$t('no_roomname_defined');
            } else if (this.general.rooms.some((room) => room === v)) {
              return this.$t('room_already_exists');
            }

            return true;
          },
        ],
      };

      this.loading = false;
      this.loadingProgress = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  methods: {
    addRoom() {
      const valid = this.$refs.form.validate();

      if (valid) {
        this.general.rooms.push(this.roomName);
        this.$refs.form.reset();

        this.$toast.success(this.$t('successfully_created'));
      }
    },
    async generalWatcher(newValue) {
      this.loadingProgress = true;

      if (this.generalTimeout) {
        clearTimeout(this.generalTimeout);
        this.generalTimeout = null;
      }

      this.generalTimeout = setTimeout(async () => {
        try {
          await changeSetting(
            'general',
            newValue,
            `?restartAutomation=${this.restartAutomation}&stopAutomation=${this.stopAutomation}`
          );
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }

        this.loadingProgress = false;
      }, 2000);
    },
    removeRoom(room, index) {
      this.general.rooms.splice(index, 1);
      this.$toast.success(this.$t('successfully_removed'));
    },
  },
};
</script>

<style scoped>
div >>> input::placeholder {
  color: var(--cui-text-hint) !important;
}
</style>
