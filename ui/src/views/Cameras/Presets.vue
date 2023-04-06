<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .pl-safe.pr-safe
    
    .tw-flex.tw-justify-between
      .header-title.tw-flex.tw-items-center
        .page-title Presets
      .header-utils.tw-flex.tw-justify-center.tw-items-center

    .tw-mt-5
      v-data-table.tw-w-full(v-if="listMode && presets.length" @click:row="clickRow" :items-per-page="-1" calculate-widths disable-pagination hide-default-footer :loading="loading" :headers="headers" :items="presets" :no-data-text="$t('no_data_available')" item-key="name" class="elevation-1" mobile-breakpoint="0")
        template(v-slot:item.name="{ item }")
          b {{ item.presetName }} ({{ item.presetId }})
        template(v-slot:item.liveFeed="{ item }")
          v-chip(color="var(--cui-primary)" dark small style="cursor: pointer" @click="$router.push(`/cameras/${this.$route.params.name}/feed/${item.presetId}`)") Live
        template(v-slot:item.liveGraph="{ item }")
          v-chip(color="var(--cui-primary)" dark small style="cursor: pointer" @click="$router.push(`/cameras/${this.$route.params.name}/preset/${encodeURIComponent(item.presetName)}--${item.presetId}`)") Graph


      //- div(v-for="room in rooms" :key="room" v-if="!listMode && ((room === 'Standard' && cameras.find((cam) => cam.settings.room === room)) || room !== 'Standard')")
      //-   .tw-mt-7(v-if="room !== 'Standard'")
        
      //-   h4(style="font-weight: 700;") {{ room === 'Standard' ? $t('standard') : room }}
      //-   v-divider.tw-mt-3

      //-   v-layout.tw-mt-5(row wrap)
      //-     v-flex.tw-mb-3.tw-px-2(v-if="!listMode && camera.settings.room === room" xs12 sm6 md4 lg3 v-for="camera in cameras" :key="camera.name")
      //-       vue-aspect-ratio(ar="4:3")
      //-         VideoCard(:camera="camera" title titlePosition="bottom" snapshot)

    infinite-loading(:identifier="infiniteId", @infinite="infiniteHandler")
      div(slot="spinner")
        v-progress-circular(indeterminate color="var(--cui-primary)")
      .tw-mt-10.tw-text-sm.text-muted(slot="no-more") {{ $t("no_more_cameras") }}
      .tw-mt-10.tw-text-sm.text-muted(slot="no-results") {{ $t("no_cameras") }} :(

  LightBox(
    ref="lightboxBanner"
    :media="notImages"
    :showLightBox="false"
    :showThumbs="false"
    showCaption
    disableScroll
  )
  
</template>

<script>
import LightBox from 'vue-it-bigger';
import 'vue-it-bigger/dist/vue-it-bigger.min.css';
import InfiniteLoading from 'vue-infinite-loading';
import { mdiCircle, mdiPlus, mdiFormatListBulleted, mdiViewModule } from '@mdi/js';
import VueAspectRatio from 'vue-aspect-ratio';

import { getSetting } from '@/api/settings.api';
import { getCameraPresets } from '@/api/cameras.api';

import FilterCard from '@/components/filter.vue';
import VideoCard from '@/components/camera-card.vue';

import socket from '@/mixins/socket';

export default {
  name: 'Cameras',

  components: {
    LightBox,
    FilterCard,
    InfiniteLoading,
    VideoCard,
    'vue-aspect-ratio': VueAspectRatio,
  },

  mixins: [socket],

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  data: () => ({
    icons: {
      mdiCircle,
      mdiPlus,
      mdiFormatListBulleted,
      mdiViewModule,
    },

    presets: [],
    loading: false,
    infiniteId: Date.now(),
    page: 1,
    query: '',

    rooms: [],
    camStates: [],

    backupHeaders: [],
    heckupHeaders: [],
    headers: [
      {
        text: 'Name',
        value: 'name',
        align: 'start',
        sortable: true,
        class: 'tw-pl-3 tw-pr-1',
        cellClass: 'tw-pl-3 tw-pr-1',
      },
      {
        text: '',
        value: 'liveFeed',
        align: 'start',
        sortable: false,
        class: 'tw-pl-3 tw-pr-1',
        cellClass: 'tw-pl-3 tw-pr-1',
      },
    ],

    oldSelected: false,
    listMode: true,
    showListOptions: true,
  }),

  beforeDestroy() {
    ['resize', 'orientationchange'].forEach((event) => {
      window.removeEventListener(event, this.onResize);
    });
  },

  async mounted() {
    const response = await getSetting('general');
    this.rooms = response.data.rooms;
    this.listMode = this.oldSelected = localStorage.getItem('listModeCameras') === '1';
    this.backupHeaders = [...this.headers];

    this.loading = false;

    ['resize', 'orientationchange'].forEach((event) => {
      window.addEventListener(event, this.onResize);
    });

    this.onResize();
  },

  methods: {
    cameraStatus(data) {
      if (!this.camStates.some((cam) => cam.name === data.name)) {
        this.camStates.push(data);
      }
    },
    clickRow(item) {
      this.$router.push(
        `/cameras/${this.$route.params.name}/preset/${encodeURIComponent(item.presetName)}--${item.presetId}`
      );
    },
    changeListView(view) {
      localStorage.setItem('listModeCameras', view);
      this.listMode = this.oldSelected = view === 1;
    },
    filter(filterQuery) {
      this.loading = true;
      this.cameras = [];
      this.page = 1;
      this.query = filterQuery;
      this.infiniteId = Date.now();
      this.loading = false;
    },
    async infiniteHandler($state) {
      try {
        const response = await getCameraPresets(this.$route.params.name);

        console.log(response);

        if (response.data.length > 0) {
          this.page += 1;
          this.presets = response.data;
          console.log(this.presets);

          $state.loaded();
        } else {
          $state.complete();
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    onResize() {
      const removeHeaders = [];

      if (this.windowWidth() < 415) {
        removeHeaders.push('model', 'address', 'lastNotification', 'liveFeed');
      } else if (this.windowWidth() < 650) {
        removeHeaders.push('model', 'address', 'lastNotification');
      } else if (this.windowWidth() <= 800) {
        removeHeaders.push('model', 'lastNotification');
      } else if (this.windowWidth() < 900) {
        removeHeaders.push('model');

        /*if (!this.toggleView) {
          this.toggleView = true;
          this.oldSelected = this.listMode;
        }

        this.showListOptions = false;
        this.listMode = false;*/
      } else {
        /*this.showListOptions = true;

        if (this.toggleView) {
          this.listMode = this.oldSelected;
          this.toggleView = false;
        }*/
      }

      let headers = [...this.backupHeaders];

      if (removeHeaders.length) {
        headers = headers.filter((header) => !removeHeaders.some((val) => header.value === val));
      }

      this.headers = headers;
    },
    windowWidth() {
      return window.innerWidth && document.documentElement.clientWidth
        ? Math.min(window.innerWidth, document.documentElement.clientWidth)
        : window.innerWidth ||
            document.documentElement.clientWidth ||
            document.getElementsByTagName('body')[0].clientWidth;
    },
  },
};
</script>

<style scoped>
.page-title {
  font-size: 1.3rem !important;
  letter-spacing: -0.025em !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
}

.header {
  display: flex;
}

div >>> .v-data-table-header__icon {
  display: none;
}
</style>
