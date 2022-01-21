<template lang="pug">
.content
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  .widget.tw-h-full(v-else)
    VideoCard(:ref="item.name" :camera="item" title titlePosition="top" status :stream="item.live" :refreshSnapshot="!item.live" hideNotifications hideIndicatorFullscreen)
</template>

<script>
/* eslint-disable vue/require-default-prop */
import VideoCard from '@/components/camera-card.vue';

export default {
  name: 'CameraWidget',

  components: {
    VideoCard,
  },

  props: {
    item: Object,
  },

  data: () => ({
    loading: true,
  }),

  mounted() {
    this.loading = false;
  },

  beforeDestroy() {
    this.$refs[this.item.name]?.destroy();
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  border-radius: 13px;
  background: rgb(17, 17, 17);
  border: 1px solid var(--cui-bg-app-bar-border);
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
}

.widget {
}

.video-card-top-title {
  padding: 0;
  margin: 0;
  font-size: 13px;
  background: var(--cui-bg-card);
  height: 38px;
  padding: 4px;
  padding-left: 10px;
  padding-right: 10px;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
}
</style>
