<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .pl-safe.pr-safe
    
    .header.tw-justify-between.tw-items-center.tw-relative.tw-z-10.tw-items-stretch
      .tw-block
        h2 {{ $t($route.name.toLowerCase()) }}

    .tw-mt-10(v-for="room in rooms" :key="room" v-if="(room === 'Standard' && cameras.find((cam) => cam.settings.room === room)) || room !== 'Standard'")
      h3 {{ room === 'Standard' ? $t('standard') : room }}
      v-divider.tw-mt-3

      v-layout.tw-mt-5(row wrap)
        v-flex.tw-mb-3.tw-px-2(xs12 sm6 md4 lg3 v-for="camera in cameras" :key="camera.name" :style="`height: ${height}px`" v-if="camera.settings.room === room")
          VideoCard(:camera="camera" title titlePosition="bottom" snapshot)

    infinite-loading(:identifier="infiniteId", @infinite="infiniteHandler")
      div(slot="spinner")
        v-progress-circular(indeterminate color="var(--cui-primary)")
      .tw-mt-10.tw-text-sm.text-muted(slot="no-more") {{ $t("no_more_cameras") }}
      .tw-mt-10.tw-text-sm.text-muted(slot="no-results") {{ $t("no_cameras") }} :(

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
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';
import CoolLightBox from 'vue-cool-lightbox';
import InfiniteLoading from 'vue-infinite-loading';
import { getSetting } from '@/api/settings.api';
import { getCameras, getCameraSettings } from '@/api/cameras.api';
import { getNotifications } from '@/api/notifications.api';

import FilterCard from '@/components/filter.vue';
import VideoCard from '@/components/camera-card.vue';

import socket from '@/mixins/socket';

export default {
  name: 'Cameras',

  components: {
    CoolLightBox,
    FilterCard,
    InfiniteLoading,
    VideoCard,
  },

  mixins: [socket],

  data: () => ({
    cameras: [],
    loading: false,
    infiniteId: Date.now(),
    page: 1,
    query: '',
    rooms: [],
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

  async mounted() {
    const response = await getSetting('general');
    this.rooms = response.data.rooms;

    this.loading = false;
  },

  methods: {
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
        const response = await getCameras(`?refresh=true&page=${this.page || 1}` + this.query);

        for (const camera of response.data.result) {
          const settings = await getCameraSettings(camera.name);
          camera.settings = settings.data;

          const lastNotification = await getNotifications(`?cameras=${camera.name}&pageSize=5`);
          camera.lastNotification = lastNotification.data.result.length > 0 ? lastNotification.data.result[0] : false;
        }

        if (response.data.result.length > 0) {
          this.page += 1;
          this.cameras = [...this.cameras, ...response.data.result];
          $state.loaded();
        } else {
          $state.complete();
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
  },
};
</script>

<style scoped>
.header {
  display: flex;
}
</style>
