<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-w-full.mh-100(v-else)
  .tw-h-full.tw-flex.tw-justify-center.tw-items-center
    vue-aspect-ratio(ar="16:9" :width="`${width}px`")
      v-btn.tw-text-white(style="top: 10px" absolute top left fab x-small color="rgba(0, 0, 0, 0.5)" @click="$router.push(`/cameras/${camera.name}`)")
        v-icon(size="20") {{ icons['mdiChevronLeft'] }}
      VideoCard(:ref="camera.name" :camera="camera" stream noLink hideNotifications)
</template>

<script>
import { mdiChevronLeft } from '@mdi/js';
import VueAspectRatio from 'vue-aspect-ratio';

import { getCamera, getCameraSettings } from '@/api/cameras.api';

import VideoCard from '@/components/camera-card.vue';

import socket from '@/mixins/socket';

export default {
  name: 'Camera',

  components: {
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
      mdiChevronLeft,
    },
    camera: {},
    cols: 12,
    width: 1024,
    loading: true,
  }),

  async mounted() {
    try {
      const camera = await getCamera(this.$route.params.name);
      const settings = await getCameraSettings(this.$route.params.name);

      camera.data.settings = settings.data;
      this.camera = camera.data;

      ['resize', 'orientationchange'].forEach((event) => {
        window.addEventListener(event, this.onResize);
      });

      this.onResize();

      this.loading = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    ['resize', 'orientationchange'].forEach((event) => {
      window.removeEventListener(event, this.onResize);
    });
  },

  methods: {
    onResize() {
      this.width = this.windowWidth() < 1024 ? this.windowWidth() - 40 : 1024;
    },
    windowHeight() {
      return Math.max(document.documentElement.clientHeight, window.innerHeight);
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

<style scoped></style>
