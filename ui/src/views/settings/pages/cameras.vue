<template lang="pug">
.w-100.h-100
  .d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
    b-spinner.text-color-primary
  transition-group(name="fade", mode="out-in", v-if="loading")
  transition-group(name="fade", mode="out-in", v-else)
    .d-flex.flex-wrap.justify-content-between(key="loaded")
      .col-12(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel(['settings:cameras:edit'])")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.cameras.aws.expand ? "180" : "-90"', @click="settingsLayout.cameras.aws.expand = !settingsLayout.cameras.aws.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.cameras.aws.expand = !settingsLayout.cameras.aws.expand") {{ $t("aws") }}
        b-collapse(
          v-model="settingsLayout.cameras.aws.expand",
          id="expandAws"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="aws.active"
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    :aria-expanded="aws.active ? 'true' : 'false'"
                    aria-controls="aws"
                  )
              b-collapse(
                v-model="aws.active",
                id="aws"
              )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_access_key_id") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='text',
                      :placeholder="$t('aws_access_key_id')",
                      v-model="aws.accessKeyId"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_secret_access_key") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='text',
                      :placeholder="$t('aws_secret_access_key')",
                      v-model="aws.secretAccessKey"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_region") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='text',
                      :placeholder="$t('aws_region')",
                      v-model="aws.region"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_contingent_total") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='number',
                      :min="0",
                      :max="10000",
                      :placeholder="$t('aws_contingent_total')",
                      v-model="aws.contingent_total"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_contingent_left") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='number',
                      :disabled="true"
                      v-model="aws.contingent_left"
                      style="background: var(--third-bg-color) !important"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_last_rekognition") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='text',
                      :disabled="true"
                      v-model="aws.last_rekognition"
                      style="background: var(--third-bg-color) !important"
                    )
      .col-12.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="cameras.length && checkLevel('settings:cameras:edit')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.cameras.cameras.expand ? "180" : "-90"', @click="settingsLayout.cameras.cameras.expand = !settingsLayout.cameras.cameras.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.cameras.cameras.expand = !settingsLayout.cameras.cameras.expand") {{ $t("cameras") }}
        b-collapse(
          v-model="settingsLayout.cameras.cameras.expand",
          id="expandCameras"
        )
          div.mt-2.mb-4(v-for="camera in cameras" :key="camera.name" data-aos="fade-up" data-aos-duration="1000")
            b-icon.cursor-pointer.expandTriangleCamera(icon="triangle-fill", aria-hidden="true", :rotate='camera.expand ? "180" : "-90"', @click="camera.expand = !camera.expand")
            .settings-box-header(@click="camera.expand = !camera.expand") {{ camera.name }}
            b-collapse(
              v-model="camera.expand"
            )
              .settings-box.container.no-radius-top
                .row
                  .col-12
                    label.fs-6 {{ $t("room") }}
                    b-form-select(
                      v-model="camera.room"
                      :options="general.rooms",
                    )
                    hr.hr-underline
                    label.fs-6 {{ $t("video_resolution") }}
                    b-form-select(
                      v-model="camera.resolution"
                      :options="camerasResolutions"
                    )
                    hr.hr-underline
                    label.fs-6 {{ $t("ping_timeout") }}
                    b-form-input(
                      type='number',
                      :min="1",
                      :max="60",
                      placeholder="1",
                      v-model="camera.pingTimeout"
                      number
                    )
                    hr.hr-underline
                  .col-8.d-flex.flex-wrap.align-content-center {{ $t("audio") }}
                  .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="camera.audio",
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true"
                    )
                  .row.w-100.m-0.p-0(v-if="aws.active")
                    .col-12
                      hr.hr-underline
                    .col-8.d-flex.flex-wrap.align-content-center {{ $t("rekognition") }}
                    .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                      toggle-button(
                        v-model="camera.rekognition.active",
                        color="var(--primary-color) !important",
                        :height="30",
                        :sync="true"
                      )
                    .col-12
                      hr.hr-underline
                    .col-12
                      label.fs-6 {{ `${$t("confidence")} %` }}
                      b-form-input(
                        type='number',
                        :min="0",
                        :max="100",
                        :placeholder="`${$t('confidence')} %`",
                        v-model="camera.rekognition.confidence"
                      )
                      hr.hr-underline
                      label.fs-6 {{ $t("labels") }}
                      b-form-input(
                        type='text',
                        :placeholder="$t('labels')",
                        v-model="camera.rekognition.labels"
                      )
                      hr.hr-underline
      .col-12.d-flex.justify-content-center(v-else)
        span.text-muted-2 {{ $t("no_cameras") }}
</template>

<script>
import { BIcon, BIconTriangleFill } from 'bootstrap-vue';
import { ToggleButton } from 'vue-js-toggle-button';

import { getSetting, changeSetting } from '@/api/settings.api';
import localStorageMixin from '@/mixins/localstorage.mixin';

export default {
  name: 'SettingsCameras',
  components: {
    BIcon,
    BIconTriangleFill,
    ToggleButton,
  },
  mixins: [localStorageMixin],
  data() {
    return {
      aws: {},
      awsTimer: null,
      cameras: [],
      camerasTimer: null,
      camerasResolutions: ['256x144', '426x240', '480x360', '640x480', '1280x720', '1920x1080'],
      form: {
        snapshotTimer: 10,
      },
      general: {
        exclude: [],
        rooms: [],
      },
      loading: true,
      settingsLayout: {},
    };
  },
  async created() {
    try {
      if (this.checkLevel('settings:general:access')) {
        const general = await getSetting('general');
        this.general = general.data;
      }

      if (this.checkLevel('settings:cameras:access')) {
        const cameras = await getSetting('cameras');
        this.cameras = cameras.data.map((camera) => {
          camera.rekognition.labels = camera.rekognition.labels.toString();
          return camera;
        });

        const aws = await getSetting('aws');
        this.aws = aws.data;
      }

      this.$watch('aws', this.awsWatcher, { deep: true });
      this.$watch('cameras', this.camerasWatcher, { deep: true });

      this.loading = false;
    } catch (err) {
      this.$toast.error(err.message);
    }
  },
  methods: {
    async awsWatcher(newValue) {
      if (this.awsTimer) {
        clearTimeout(this.awsTimer);
        this.awsTimer = null;
      }

      this.awsTimer = setTimeout(async () => {
        try {
          await changeSetting('aws', newValue);
        } catch (error) {
          this.$toast.error(error.message);
        }
      }, 2000);
    },
    async camerasWatcher(newValue) {
      if (this.camerasTimer) {
        clearTimeout(this.camerasTimer);
        this.camerasTimer = null;
      }

      this.camerasTimer = setTimeout(async () => {
        try {
          await changeSetting('cameras', newValue, '?stopStream=true');
        } catch (error) {
          this.$toast.error(error.message);
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
