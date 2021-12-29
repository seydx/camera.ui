<template lang="pug">
v-dialog(v-model="dialog" width="500" scrollable @click:outside="closeDialog")
  template(v-slot:activator='{ on, attrs }')
    v-btn.tw-text-white.tw-mr-1(fab height="38px" width="38px" color="var(--cui-primary)" v-bind='attrs' v-on='on')
      v-icon {{ icons['mdiPlus'] }}
  v-card
    v-card-title {{ $t('add_camera') }}
    v-divider
    
    .tw-flex.tw-items-center.tw-justify-center(v-if="loading")
      v-progress-circular(indeterminate color="var(--cui-primary)")
    
    v-card-text.tw-p-7.text-default
      .tw-flex.tw-justify-center.tw-items-center.tw-w-full.tw-h-full(v-if="loading") 
        v-progress-circular(indeterminate color="var(--cui-primary)")
      
      .tw-block
        label.form-input-label Name
          v-text-field(v-model="cam.name" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiAlphabetical'] }}

        label.form-input-label Video Source
          v-text-field(v-model="cam.videoConfig.source" :hint="$t('source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
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

        .tw-flex.tw-justify-between.tw-items-center.tw-mb-3
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

    v-divider
    v-card-actions.tw-flex.tw-justify-end
      v-btn.text-default(text @click='closeDialog') {{ $t('cancel') }}
      v-btn(color='var(--cui-primary)' text @click='addCamera') {{ $t('add') }}

</template>

<script>
import { mdiAlphabetical, mdiInformationOutline, mdiPlus } from '@mdi/js';

import { addCamera } from '@/api/cameras.api';

export default {
  name: 'AddCamera',

  data: () => ({
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
      recordOnMovement: null,
      prebuffering: null,
      videoConfig: {
        source: '',
        stillImageSource: '',
        stimeout: 10,
        audio: null,
        debug: null,
      },
    },

    camReset: {},
  }),

  mounted() {
    this.camReset = { ...this.cam };
    this.loading = false;
  },

  methods: {
    async addCamera() {
      this.loading = true;

      try {
        await addCamera(this.cam);

        this.$toast.success(`${this.$t('successfully_added_camera')} - ${this.$t('restart_cameraui')}`);
        this.closeDialog();
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);

        this.loading = false;
      }
    },

    closeDialog() {
      this.dialog = false;
      this.loading = false;

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
</style>
