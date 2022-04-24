<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-7.tw-mt-5(v-if="!loading")
    .page-subtitle {{ $t('aws') }}
    .page-subtitle-info {{ $t('amazon_rekognition') }}

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="aws.active")

    label.form-input-label {{ $t('aws_access_key_id') }}
    v-text-field(v-model="aws.accessKeyId" prepend-inner-icon="mdi-identifier" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.string" required solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiIdentifier'] }}

    label.form-input-label {{ $t('aws_secret_access_key') }}
    v-text-field(v-model="aws.secretAccessKey" prepend-inner-icon="mdi-lock" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.string" required solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiLock'] }}

    label.form-input-label {{ $t('aws_region') }}
    v-text-field(v-model="aws.region" prepend-inner-icon="mdi-crosshairs-gps" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.string" required solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiCrosshairsGps'] }}

    label.form-input-label {{ $t('aws_contingent_total') }}
    v-text-field(v-model.number="aws.contingent_total" type="number" prepend-inner-icon="mdi-contain" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.string" required solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiContain'] }}

    label.form-input-label {{ $t('aws_contingent_left') }}
    v-text-field(disabled v-model="aws.contingent_left" prepend-inner-icon="mdi-contain" color="var(--cui-text-default)" :rules="rules.string" required solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiContain'] }}

    label.form-input-label {{ $t('aws_last_rekognition') }}
    v-text-field(disabled v-model="aws.last_rekognition" prepend-inner-icon="mdi-timelapse" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.string" required solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiTimelapse'] }}

</template>

<script>
import { mdiContain, mdiCrosshairsGps, mdiIdentifier, mdiLock, mdiTimelapse } from '@mdi/js';

import { getSetting, changeSetting } from '@/api/settings.api';

export default {
  name: 'RekognitionSettings',

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data() {
    return {
      icons: {
        mdiContain,
        mdiCrosshairsGps,
        mdiIdentifier,
        mdiLock,
        mdiTimelapse,
      },

      loading: true,
      loadingProgress: true,

      aws: {},
      awsTimeout: null,

      rules: {
        string: [(v) => !!v || this.$t('field_must_not_be_empty')],
      },
    };
  },

  async created() {
    try {
      const aws = await getSetting('aws');
      this.aws = aws.data;

      this.$watch('aws', this.awsWatcher, { deep: true });

      this.loading = false;
      this.loadingProgress = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  methods: {
    async awsWatcher(newValue) {
      this.loadingProgress = true;

      if (this.awsTimeout) {
        clearTimeout(this.awsTimeout);
        this.awsTimeout = null;
      }

      this.awsTimeout = setTimeout(async () => {
        try {
          await changeSetting('aws', newValue);
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
