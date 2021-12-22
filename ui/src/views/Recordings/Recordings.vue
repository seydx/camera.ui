<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .pl-safe.pr-safe
    
    .header.tw-justify-between.tw-items-center.tw-relative.tw-z-10.tw-items-stretch
      .tw-block
        h2 {{ $t($route.name.toLowerCase()) }}
      .header-utils
        v-btn(icon height="38px" width="38px" color="red" :disabled="!recordings.length" @click="removeAll")
          v-icon {{ icons['mdiDelete'] }}
        FilterCard(camerasSelect datePicker labelSelect roomSelect typeSelect @filter="filter")

    v-layout.tw-mt-5(row wrap)
      v-flex.tw-mb-4.tw-px-2(xs12 sm6 md4 lg3 xl2 v-for="(recording, i) in recordings" :key="recording.id" :style="`height: ${height}px`")
        RecordingCard(ref="recordings" :recording="recording" @show="index = i" @remove="remove(recording, i)")

    infinite-loading(:identifier="infiniteId" @infinite="infiniteHandler")
      .tw-mt-10(slot="spinner")
        v-progress-circular(indeterminate color="var(--cui-primary)")
      .tw-mt-10.tw-text-sm.text-muted(slot="no-more") {{ $t("no_more_recordings") }}
      .tw-mt-10.tw-text-sm.text-muted(slot="no-results") {{ $t("no_recordings") }}
        
  CoolLightBox(
    :items="images" 
    :index="index"
    @close="index = null"
    :closeOnClickOutsideMobile="true"
    :useZoomBar="true",
    :zIndex=99999
  )

  CoolLightBox(
    :items="notImages" 
    :index="notIndex"
    @close="closeHandler"
    :closeOnClickOutsideMobile="true"
    :useZoomBar="true",
    :zIndex=99999
  )

</template>

<script>
import CoolLightBox from 'vue-cool-lightbox';
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';
import InfiniteLoading from 'vue-infinite-loading';
import { mdiDelete } from '@mdi/js';

import { getRecordings, removeRecordings } from '@/api/recordings.api';

import FilterCard from '@/components/filter.vue';
import RecordingCard from '@/components/recording-card.vue';

import socket from '@/mixins/socket';

export default {
  name: 'Recordings',

  components: {
    CoolLightBox,
    FilterCard,
    InfiniteLoading,
    RecordingCard,
  },

  mixins: [socket],

  data: () => ({
    icons: {
      mdiDelete,
    },
    images: [],
    index: null,
    infiniteId: Date.now(),
    loading: false,
    page: 1,
    query: '',
    recordings: [],
  }),

  computed: {
    height() {
      switch (this.$vuetify.breakpoint.name) {
        case 'xs':
          return 300;
        case 'sm':
          return 250;
        case 'md':
          return 225;
        case 'lg':
          return 225;
        case 'xl':
          return 250;
        default:
          return 250;
      }
    },
  },

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  mounted() {
    this.loading = false;
  },

  methods: {
    filter(filterQuery) {
      this.loading = true;
      this.recordings = [];
      this.page = 1;
      this.query = filterQuery;
      this.infiniteId = Date.now();
      this.loading = false;
    },
    async infiniteHandler($state) {
      try {
        const response = await getRecordings(`?refresh=true&page=${this.page || 1}` + this.query);

        if (response.data.result.length > 0) {
          this.page += 1;
          this.recordings = [...this.recordings, ...response.data.result];

          this.images = this.recordings.map((rec) => {
            return {
              title: `${rec.camera} - ${rec.time}`,
              src: `/files/${rec.fileName}`,
              thumb: rec.recordType === 'Video' ? `/files/${rec.name}@2.jpeg` : `/files/${rec.fileName}`,
            };
          });

          $state.loaded();
        } else {
          $state.complete();
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    async remove(recording, index) {
      this.recordings = this.recordings.filter((recording, i) => i !== index);
      this.images = this.images.filter((image, i) => i !== index);
      this.$toast.success(`${this.$t('recording')} ${this.$t('removed')}!`);
    },
    async removeAll() {
      try {
        await removeRecordings();

        this.recordings = [];
        this.images = [];
        this.$toast.success(this.$t('all_recordings_removed'));
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
  },
};
</script>

<style scoped>
div >>> .theme--light.v-expansion-panels .v-expansion-panel-header .v-expansion-panel-header__icon .v-icon {
  color: rgba(var(--cui-text-default-rgb)) !important;
}

.theme--light.v-btn.v-btn--disabled,
.theme--light.v-btn.v-btn--disabled .v-icon,
.theme--light.v-btn.v-btn--disabled .v-btn__loading {
  color: var(--cui-text-disabled) !important;
}

.header {
  display: flex;
}
</style>
