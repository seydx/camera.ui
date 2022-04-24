<template lang="pug">
v-dialog(v-model="dialog" width="600" scrollable @click:outside="closeDialog")
  template(v-slot:activator='{ on, attrs }')
    v-btn.tw-text-white(block color="success" v-bind='attrs' v-on='on') {{ $t('add_new_camera') }}
  v-card
    v-card-title {{ $t('add_camera') }}
    v-divider

    v-card-text.tw-p-7.text-default
      v-form.tw-relative(ref="form" v-model="valid" lazy-validation)
        .tw-flex.tw-items-center.tw-justify-center.tw-absolute.tw-inset-0.tw-z-10(v-if="loading")
          v-progress-circular(indeterminate color="var(--cui-primary)")
        .tw-block(v-else)
          div
            h2.tw-mb-5 {{ $t('general') }}

            label.form-input-label Name
              span.tw-text-red-500 *
            v-text-field(v-model="cam.name" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.camera" required solo)
              template(v-slot:prepend-inner)
                v-icon.text-muted {{ icons['mdiAlphabetical'] }}

            label.form-input-label Video Source
              span.tw-text-red-500 *
            v-text-field(v-model="cam.videoConfig.source" :hint="$t('source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.string" required solo)
              template(v-slot:prepend-inner)
                v-icon.text-muted {{ icons['mdiAlphabetical'] }}
              template(v-slot:message="{ key, message}")
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ message }}
                  
            label.form-input-label Video Substream Source
            v-text-field(v-model="cam.videoConfig.subSource" :hint="$t('sub_source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
              template(v-slot:prepend-inner)
                  v-icon.text-muted {{ icons['mdiAlphabetical'] }}
              template(v-slot:message="{ key, message}")
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ message }}

            label.form-input-label Still Image Source
            v-text-field(v-model="cam.videoConfig.stillImageSource" :hint="$t('still_image_source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
              template(v-slot:prepend-inner)
                  v-icon.text-muted {{ icons['mdiAlphabetical'] }}
              template(v-slot:message="{ key, message}")
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ message }}

            label.form-input-label RTSP Transport
            v-text-field(v-model="cam.videoConfig.rtspTransport" :hint="$t('rtsp_transport_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
              template(v-slot:prepend-inner)
                v-icon.text-muted {{ icons['mdiAlphabetical'] }}
              template(v-slot:message="{ key, message}")
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ message }}

            label.form-input-label Video Codec
            v-text-field(v-model="cam.videoConfig.vcodec" :hint="$t('video_codec_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
              template(v-slot:prepend-inner)
                v-icon.text-muted {{ icons['mdiAlphabetical'] }}
              template(v-slot:message="{ key, message}")
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ message }}

            label.form-input-label Audio Codec
            v-text-field(v-model="cam.videoConfig.acodec" :hint="$t('audio_codec_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
              template(v-slot:prepend-inner)
                v-icon.text-muted {{ icons['mdiAlphabetical'] }}
              template(v-slot:message="{ key, message}")
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ message }}

          v-divider.tw-my-6

          div
            h2.tw-mb-5 {{ $t('options') }}

            .tw-flex.tw-justify-between.tw-items-center.tw-mt-3
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label {{ $t('record_on_movement') }}
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('record_on_movement_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.recordOnMovement")

            .tw-flex.tw-justify-between.tw-items-center
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label Prebuffering
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('prebuffering_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.prebuffering")

            .tw-flex.tw-justify-between.tw-items-center
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label Audio
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('audio_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.audio")

            .tw-flex.tw-justify-between.tw-items-center
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label Debug
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('debug_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.debug")

          v-divider.tw-my-6

          div
            h2.tw-mb-5 {{ $t('videoanalysis') }}

            .tw-flex.tw-justify-between.tw-items-center
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label {{ $t('active') }}
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('videoanalysis_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.videoanalysis.active")

          v-divider.tw-mt-3.tw-mb-6(v-if="moduleName === 'homebridge-camera-ui' || env === 'development'")

          div(v-if="moduleName === 'homebridge-camera-ui' || env === 'development'")
            h2.tw-mb-5 Homebridge

            .tw-flex.tw-justify-between.tw-items-center.tw-mt-3
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label Unbridge (Recommended)
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('unbridge_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.unbridge")

            .tw-flex.tw-justify-between.tw-items-center
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label Motion Sensor
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('motionSensor_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.motion")

            .tw-flex.tw-justify-between.tw-items-center
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label Doorbell Sensor
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('doorbellSensor_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.doorbell")

            .tw-flex.tw-justify-between.tw-items-center
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label Motion / Doorbell Switches
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('motionDoorbellSwitch_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.switches")

            .tw-flex.tw-justify-between.tw-items-center.tw-mb-3
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label Trigger Doorbell on Motion
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('motionDoorbell_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.motionDoorbell")

            .tw-flex.tw-justify-between.tw-items-center
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label Exclude Switch
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('excludeSwitch_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.excludeSwitch")

            .tw-flex.tw-justify-between.tw-items-center.tw-mb-3
              .tw-block.tw-w-full.tw-pr-2
                label.form-input-label Privacy Switch
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ $t('privacySwitch_info') }}
              v-switch(color="var(--cui-primary)" v-model="cam.privacySwitch")

            label.form-input-label Manufacturer
            v-text-field(v-model="cam.manufacturer" :hint="$t('manufacturer_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
              template(v-slot:prepend-inner)
                v-icon.text-muted {{ icons['mdiAlphabetical'] }}
              template(v-slot:message="{ key, message}")
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ message }}
                  
            label.form-input-label Model
            v-text-field(v-model="cam.model" :hint="$t('model_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
              template(v-slot:prepend-inner)
                v-icon.text-muted {{ icons['mdiAlphabetical'] }}
              template(v-slot:message="{ key, message}")
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ message }}
                  
            label.form-input-label Serial Number
            v-text-field(v-model="cam.serialNumber" :hint="$t('serialNumber_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
              template(v-slot:prepend-inner)
                v-icon.text-muted {{ icons['mdiAlphabetical'] }}
              template(v-slot:message="{ key, message}")
                .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                  v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                  .input-info.tw-italic {{ message }}

    v-divider
    v-card-actions.tw-flex.tw-justify-end
      v-btn.text-default(text @click='closeDialog') {{ $t('cancel') }}
      v-btn(color='var(--cui-primary)' text @click='createCamera') {{ $t('add') }}

</template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiAlphabetical, mdiInformationOutline, mdiPlus } from '@mdi/js';

import { addCamera } from '@/api/cameras.api';

export default {
  name: 'AddCamera',

  props: {
    cameras: Array,
  },

  data() {
    return {
      env: '',
      moduleName: 'camera.ui',

      valid: true,
      rules: {
        camera: [
          (v) => {
            if (!v || !v.trim()) {
              return this.$t('field_must_not_be_empty');
            } else if (this.cameras.some((camera) => camera.name === v)) {
              return this.$t('camera_already_exists');
            }

            return true;
          },
        ],
        string: [(v) => !!v || this.$t('field_must_not_be_empty')],
      },

      loading: true,
      dialog: false,

      icons: {
        mdiAlphabetical,
        mdiInformationOutline,
        mdiPlus,
      },

      cam: {
        name: '',
        motionTimeout: 15,
        recordOnMovement: false,
        prebuffering: false,
        videoConfig: {
          source: '',
          stillImageSource: '',
          stimeout: 10,
          audio: false,
          debug: false,
        },
        mqtt: {},
        smtp: {
          email: '',
        },
        videoanalysis: {
          active: false,
        },
      },

      camReset: {},
    };
  },

  computed: {
    uiConfig() {
      return this.$store.state.config.ui;
    },
  },

  watch: {
    dialog(visible) {
      if (visible) {
        setTimeout(() => this.$refs.form.reset(), 100);
      }
    },
  },

  mounted() {
    this.env = process.env.NODE_ENV;
    this.moduleName = this.uiConfig?.env?.moduleName || 'camera.ui';

    this.camReset = { ...this.cam };
    this.loading = false;
  },

  methods: {
    async createCamera() {
      if (this.loading) {
        return;
      }

      const valid = this.$refs.form.validate();

      if (valid) {
        this.loading = true;

        const camera = { ...this.cam };

        const sourceArguments = camera.videoConfig.source.split(/\s+/);

        if (!sourceArguments.includes('-i')) {
          camera.videoConfig.source = `-i ${camera.videoConfig.source}`;
        }

        camera.videoConfig.subSource = camera.videoConfig.subSource || camera.videoConfig.source;
        camera.videoConfig.stillImageSource = camera.videoConfig.stillImageSource || camera.videoConfig.source;

        camera.smtp.email = camera.name;

        try {
          await addCamera(camera);
          this.$emit('add', camera);

          this.$toast.success(`${this.$t('successfully_added_camera')}`);
          this.closeDialog();
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);

          this.loading = false;
        }
      }
    },

    closeDialog() {
      this.$refs.form.reset();
      this.loading = false;
      this.dialog = false;

      this.cam = { ...this.camReset };
    },
  },
};
</script>

<style scoped>
.input-info {
  font-size: 11px !important;
  color: var(--cui-text-hint) !important;
  max-width: 90%;
  margin-top: 4px;
}

div >>> .v-text-field__details {
  padding-left: 0 !important;
}
</style>
