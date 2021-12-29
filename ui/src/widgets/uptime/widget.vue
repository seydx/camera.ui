<template lang="pug">
.content
  .tw-text-xs.tw-absolute.tw-top-2.tw-left-2.tw-font-bold.text-muted {{ $t('uptime') }}

  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  .tw-h-full.tw-w-full.tw-p-4.tw-relative.tw-flex.tw-flex-row.tw-items-center.tw-justify-center(v-else)
    .time.tw-text-center
      span.time-title {{ time.system }}
      .text-muted {{ $t('system') }}
    .tw-mx-2
    .time.tw-text-center
      span.time-title {{ time.process }}
      .text-muted {{ $t('process') }}
</template>

<script>
/* eslint-disable vue/require-default-prop */

export default {
  name: 'UptimeWidget',

  props: {
    item: Object,
  },

  data: () => ({
    loading: true,

    time: {
      system: '0m',
      process: '0m',
    },
  }),

  async mounted() {
    this.$socket.client.on('uptime', this.uptime);
    this.$socket.client.emit('getUptime');

    this.loading = false;
  },

  beforeDestroy() {
    this.$socket.client.off('uptime', this.uptime);
  },

  methods: {
    uptime(data) {
      this.time = {
        system: data.systemTime,
        process: data.processTime,
      };
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
  color: var(--cui-text-default);
}

.time-title {
  font-size: 1.8rem !important;
  font-weight: bolder;
}
</style>
