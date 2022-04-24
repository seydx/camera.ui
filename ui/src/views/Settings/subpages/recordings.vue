<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-7.tw-mt-5(v-if="!loading")
    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="recordings.active")

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

export default {
  name: 'RecordingsSettings',

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data() {
    return {
      icons: { mdiAt, mdiTimelapse, mdiVideoImage },

      loading: true,
      loadingProgress: true,

      recordings: {},
      recordingsTimeout: null,

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
      const recordings = await getSetting('recordings');
      this.recordings = recordings.data;

      this.$watch('recordings', this.recordingsWatcher, { deep: true });

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
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }

        this.loadingProgress = false;
      }, 2000);
    },
  },
};
</script>
