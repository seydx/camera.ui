<template lang="pug">
.content
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  .tw-h-full.tw-w-full.tw-p-4.tw-relative.tw-flex.tw-flex-col.tw-items-center.tw-justify-center(v-else)
    .time {{ time }}
    .date.text-muted
      v-icon.tw-mr-1(size="14" color="var(--cui-text-hint)" style="margin-bottom: 2px;") {{ icons['mdiCalendarRange'] }}
      span {{ date }}
</template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiCalendarRange } from '@mdi/js';

export default {
  name: 'TimeWidget',

  props: {
    item: Object,
  },

  data: () => ({
    loading: true,

    icons: {
      mdiCalendarRange,
    },

    time: '',
    timeInterval: null,
    date: '',
  }),

  mounted() {
    this.timeInterval = setInterval(() => {
      this.time = this.getCurrentTime();
    }, 1000);

    this.time = this.getCurrentTime();

    this.loading = false;
  },

  beforeDestroy() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  },

  methods: {
    getCurrentTime() {
      const currentDate = new Date();

      this.date = new Date().toISOString().slice(0, 10);

      let hours = currentDate.getHours();
      let minutes = currentDate.getMinutes();

      if (/^\d$/.test(minutes)) {
        minutes = `0${minutes}`;
      }

      //const seconds = currentDate.getSeconds() < 10 ? '0' + currentDate.getSeconds() : currentDate.getSeconds();
      const currentTime = `${hours}:${minutes}`;

      return currentTime;
    },
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  background: var(--cui-bg-default);
  border-radius: 10px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
}

.time {
  font-size: 2.5rem;
  font-weight: bolder;
  color: var(--cui-text-default);
}
</style>
