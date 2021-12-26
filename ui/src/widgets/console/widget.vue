<template lang="pug">
.content.tw-relative.tw-overflow-y-hidden
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  .tw-h-full(v-else)
    v-card-title.card-top-title.tw-flex.tw-justify-between.tw-items-center
      span.font-weight-bold.text-truncate.text-default {{ $t('log') }}
    .placeholder-card.tw-relative
      #log.tw-relative.tw-h-full
        my-terminal(:terminal="terminal" ref="xterm")
</template>

<script>
/* eslint-disable vue/require-default-prop */
import Console from '@/components/console.vue';

export default {
  name: 'ConsoleWidget',

  components: {
    'my-terminal': Console,
  },

  props: {
    item: Object,
  },

  data: () => ({
    loading: true,

    terminal: {
      pid: 1,
      name: 'terminal',
      fontSize: 13,
    },
  }),

  mounted() {
    this.loading = false;
  },

  beforeDestroy() {},

  methods: {},
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  background: var(--cui-bg-default);
  border-radius: 13px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
}

.card-top-title {
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

.placeholder-card {
  padding: 1rem;
  height: calc(100% - 38px);
  box-sizing: border-box;
  background: rgb(0, 0, 0);
  border-bottom-left-radius: 13px;
  border-bottom-right-radius: 13px;
}
</style>
