<template lang="pug">
.content(ref="clock")
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  .tw-h-full.tw-w-full.tw-p-4.tw-relative.tw-flex.tw-flex-col.tw-items-center.tw-justify-center
    .time(v-if="showDigital") {{ `${time.digital.hours}:${time.digital.minutes}` }}
    .date.text-muted(v-if="showDigital")
      v-icon.tw-mr-1(size="14" color="var(--cui-text-hint)" style="margin-bottom: 2px;") {{ icons['mdiCalendarRange'] }}
      span {{ date }}
    #clock.tw-w-full.tw-h-full(v-if="!showDigital")
      template(v-if="tick")
        AnalogCock(:minute="time.analog.minutes" :tick="tick")
</template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiCalendarRange } from '@mdi/js';

import AnalogCock from './components/analog.vue';

const timeout = (ms) => new Promise((res) => setTimeout(res, ms));

export default {
  name: 'TimeWidget',

  components: {
    AnalogCock,
  },

  props: {
    item: Object,
    grid: Object,
  },

  data: () => ({
    loading: true,

    icons: {
      mdiCalendarRange,
    },

    showDigital: false,

    date: '',
    tick: 0,
    time: {
      analog: {
        hours: 0,
        minutes: 0,
        seconds: 0,
      },
      digital: {
        hours: '00',
        minutes: '00',
        seconds: '00',
      },
    },
  }),

  async mounted() {
    await timeout(10);

    const containerWidth = this.$refs.clock.offsetWidth;
    this.showDigital = containerWidth >= 200;

    this.updateTime(new Date());
    this.loading = false;

    this.grid.on('resize', this.onResize);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
  },

  beforeDestroy() {
    if (this.timeInterval) {
      clearTimeout(this.timeInterval);
      this.timeInterval = null;
    }

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
  },

  methods: {
    onResize() {
      const containerWidth = this.$refs.clock.offsetWidth;
      this.showDigital = containerWidth >= 200;
    },
    // eslint-disable-next-line no-unused-vars
    onWidgetResize(event, el) {
      const widget = event.target.gridstackNode;

      if (widget.id === 'time') {
        this.onResize();
      }
    },
    updateTime(time) {
      this.tick++;

      const hours = time.getHours();
      const minutes = time.getMinutes();
      const seconds = time.getSeconds();

      this.time.digital = {
        hours: /^\d$/.test(hours) ? `0${hours}` : `${hours}`,
        minutes: /^\d$/.test(minutes) ? `0${minutes}` : `${minutes}`,
        seconds: /^\d$/.test(seconds) ? `0${seconds}` : `${seconds}`,
      };

      this.time.analog = {
        hours: hours,
        minutes: minutes,
        seconds: seconds,
      };

      this.date = time.toISOString().slice(0, 10);

      this.timeInterval = setTimeout(() => this.updateTime(new Date()), 1000 - new Date().getMilliseconds());
    },
  },
};
</script>

<style lang="scss" scoped>
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
