<template lang="pug">
.w-100.h-100
  vue-progress-bar
  .d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
    b-spinner.text-color-primary
  transition-group(name="fade", mode="out-in", v-if="loading")
  transition-group(name="fade", mode="out-in", v-else)
    .d-flex.flex-wrap.justify-content-between(key="loaded")
      .col-12.px-0(v-if="checkLevel('settings:recordings:edit')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.recordings.recordings.expand ? "180" : "-90"', @click="settingsLayout.recordings.recordings.expand = !settingsLayout.recordings.recordings.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.recordings.recordings.expand = !settingsLayout.recordings.recordings.expand") {{ $t("recordings") }}
        b-collapse(
          v-model="settingsLayout.recordings.recordings.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-8.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="recordings.active"
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    :aria-expanded="recordings.active ? 'true' : 'false'"
                    aria-controls="recordings"
                  )
              b-collapse(
                v-model="recordings.active"
              )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("recording_type") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-select(
                      v-model="recordings.type"
                      :options="recordingTypes"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("recording_time") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-select(
                      v-model="recordings.timer"
                      :options="recordingTimer"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("save_as") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='text',
                      :placeholder="$t('save_as')",
                      v-model="recordings.path"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("remove_after") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-select(
                      v-model="recordings.removeAfter"
                      :options="removeAfterTimer"
                    )
</template>

<script>
import { BIcon, BIconTriangleFill } from 'bootstrap-vue';
import { ToggleButton } from 'vue-js-toggle-button';

import { getSetting, changeSetting } from '@/api/settings.api';
import localStorageMixin from '@/mixins/localstorage.mixin';

export default {
  name: 'SettingsRecordings',
  components: {
    BIcon,
    BIconTriangleFill,
    ToggleButton,
  },
  mixins: [localStorageMixin],
  data() {
    return {
      recordings: {},
      recordingsTimer: null,
      loading: true,
      recordingTimer: [
        { value: 10, text: `10 ${this.$t('seconds')}` },
        { value: 20, text: `20 ${this.$t('seconds')}` },
        { value: 30, text: `30 ${this.$t('seconds')}` },
        { value: 40, text: `40 ${this.$t('seconds')}` },
        { value: 50, text: `50 ${this.$t('seconds')}` },
        { value: 60, text: `60 ${this.$t('seconds')}` },
      ],
      recordingTypes: [
        { value: 'Snapshot', text: this.$t('snapshot') },
        { value: 'Video', text: this.$t('video') },
      ],
      removeAfterTimer: [
        { value: 1, text: `1 ${this.$t('day')}` },
        { value: 3, text: `3 ${this.$t('days')}` },
        { value: 7, text: `7 ${this.$t('days')}` },
        { value: 14, text: `14 ${this.$t('days')}` },
        { value: 30, text: `30 ${this.$t('days')}` },
        { value: 0, text: this.$t('never') },
      ],
    };
  },
  async created() {
    try {
      if (this.checkLevel('settings:recordings:access')) {
        const recordings = await getSetting('recordings');
        this.recordings = recordings.data;
      }

      this.$watch('recordings', this.recordingsWatcher, { deep: true });

      this.loading = false;
    } catch (err) {
      console.log(err.data);
      this.$toast.error(err.message);
    }
  },
  methods: {
    async recordingsWatcher(newValue) {
      this.$Progress.start();

      if (this.recordingsTimer) {
        clearTimeout(this.recordingsTimer);
        this.recordingsTimer = null;
      }

      this.recordingsTimer = setTimeout(async () => {
        try {
          await changeSetting('recordings', newValue);
          this.$Progress.finish();
        } catch (error) {
          this.$toast.error(error.message);
          this.$Progress.fail();
        }
      }, 2000);
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
</style>
