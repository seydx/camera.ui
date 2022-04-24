<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-7(v-if="!loading")
    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="recordings.active")

    v-layout.tw-mb-5.tw-mt-1(row wrap)
      v-flex.tw-p-2(xs12 sm6 md6 lg6 xl6 v-for="section of sections" :key="section.id")
        v-card.tw-w-full.tw-p-6.disk-card(style="border-radius: 10px" height="167")
          v-card-subtitle.tw-p-0.v-text-field__suffix {{ section.label }}
          .tw-h-full.tw-w-full.tw-flex.tw-justify-center.tw-items-center(v-if="loadingDisk")
            v-progress-circular(indeterminate color="var(--cui-primary)")
          .tw-h-full.tw-w-full(v-else)
            .tw-flex.tw-items-end
              .tw-text-5xl.tw-font-black.tw-mt-2.text-default {{ section.value }}
              .tw-text-2xl.tw-font-medium.tw-ml-2(style="opacity: 0.7") GB
            v-progress-linear.tw-mt-3(:value="section.value" :buffer-value="maxSize" height="7" rounded color="var(--cui-primary)")
            .tw-flex.tw-justify-end
              .tw-text-base.tw-font-this.tw-font-xs(style="opacity: 0.5") {{ maxSize }} GB

    label.form-input-label {{ $t('recording_type') }}
    v-select(:value="recordings.type" v-model="recordings.type" :items="recordingTypes" prepend-inner-icon="mdi-video-image" background-color="var(--cui-bg-card)" required solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiVideoImage'] }}

    label.form-input-label {{ $t('recording_time') }}
    v-select(:suffix="$t('seconds')" :value="recordings.time" v-model="recordings.timer" :items="recordingTimer" prepend-inner-icon="mdi-timelapse" background-color="var(--cui-bg-card)" required solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiTimelapse'] }}

    label.form-input-label {{ $t('save_path') }}
    v-text-field(v-model="recordings.path" label="..." prepend-inner-icon="mdi-at" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.path" required solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiAt'] }}

    label.form-input-label {{ $t('remove_after') }}
    v-select(:suffix="$t('days')" :value="recordings.removeAfter" v-model="recordings.removeAfter" :items="removeAfterTimer" prepend-inner-icon="mdi-timelapse" background-color="var(--cui-bg-card)" required solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiTimelapse'] }}

</template>

<script>
import { mdiAt, mdiTimelapse, mdiVideoImage } from '@mdi/js';

import { getSetting, changeSetting } from '@/api/settings.api';
import { getDiskLoad } from '@/api/system.api';

export default {
  name: 'RecordingsSettings',

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data() {
    return {
      sections: [
        {
          id: 'free',
          label: this.$t('free_disk_space'),
          value: 0,
        },
        {
          id: 'rec',
          label: this.$t('recordings'),
          value: 0,
        },
      ],

      diskSpace: {},
      maxSize: 100.0,

      icons: { mdiAt, mdiTimelapse, mdiVideoImage },

      loading: true,
      loadingProgress: true,
      loadingDisk: true,

      recordings: {},
      recordingsTimeout: null,
      recordingsPathTimeout: null,
      oldRecPath: null,

      recordingTimer: [
        { value: 10, text: '10' },
        { value: 20, text: '20' },
        { value: 30, text: '30' },
        { value: 40, text: '40' },
        { value: 50, text: '50' },
        { value: 60, text: '60' },
      ],

      removeAfterTimer: [
        { value: 1, text: '1' },
        { value: 3, text: '3' },
        { value: 7, text: '7' },
        { value: 14, text: '14' },
        { value: 30, text: '30' },
        { value: 0, text: this.$t('never') },
      ],

      rules: {
        path: [(v) => (!!v && !!v.trim()) || this.$t('path_is_required')],
      },

      recordingTypes: [
        {
          text: this.$t('snapshot'),
          value: 'Snapshot',
        },
        {
          text: this.$t('video'),
          value: 'Video',
        },
      ],

      valid: true,
    };
  },

  async created() {
    try {
      await this.reloadDiskSpace();

      const recordings = await getSetting('recordings');
      this.recordings = recordings.data;
      this.oldRecPath = this.recordings.path;

      this.$watch('recordings', this.recordingsWatcher, { deep: true });
      this.$watch('recPath', this.recordingsPathWatcher, { deep: true });

      this.loading = false;
      this.loadingProgress = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  methods: {
    async recordingsWatcher(newValue) {
      this.loadingProgress = true;

      if (this.recordingsTimeout) {
        clearTimeout(this.recordingsTimeout);
        this.recordingsTimeout = null;
      }

      this.recordingsTimeout = setTimeout(async () => {
        try {
          await changeSetting('recordings', newValue);

          console.log(this.oldRecPath);
          console.log(newValue.path);

          if (this.oldRecPath && newValue.path && this.oldRecPath !== newValue.path) {
            this.reloadDiskSpace();
            this.oldRecPath = newValue.path;
          }
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }

        this.loadingProgress = false;
      }, 2000);
    },
    async reloadDiskSpace() {
      this.loadingDisk = true;

      try {
        const response = await getDiskLoad();
        this.diskSpace = response.data;

        this.maxSize = (this.diskSpace.total || this.maxSize || 100).toFixed(2);
        this.sections[0].value = (this.diskSpace.available || 0).toFixed(2);
        this.sections[1].value = (this.diskSpace.usedRecordings || 0).toFixed(2);

        this.loadingDisk = false;
      } catch (err) {
        console.log(err);
      }
    },
  },
};
</script>

<style scoped>
div >>> .v-progress-linear--rounded {
  border-radius: 5px !important;
}

.disk-card {
  box-shadow: 0 0 #0000, 0 0 #0000, 0 1px 2px 0 rgb(0 0 0 / 5%) !important;
}
</style>
