<template lang="pug">
.content.tw-overflow-y-hidden
  .tw-flex.tw-justify-between.tw-mt-1.tw-relative.tw-z-5(style="height: 25px;")
    .tw-ml-2.tw-text-xs.tw-font-bold.text-muted {{ item.id === 'freeSpace' ? sections[0].label : sections[1].label }}
    .tw-ml-auto.tw-mr-2
      v-btn.text-muted(icon x-small @click="reloadDiskSpace" style="margin-top: -5px;")
        v-icon {{ icons['mdiReload'] }}

  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading || loadingDisk")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  .tw-flex.tw-justify-center.tw-items-center.tw-w-full.disk-card.tw-px-5(v-else style="height: calc(100% - 25px")
    .tw-w-full
      .tw-flex.tw-items-end
        .tw-text-4xl.tw-font-black.tw-mt-2.text-default(v-if="item.id === 'freeSpace'") {{ sections[0].value }}
        .tw-text-2xl.tw-font-black.tw-mt-2.text-default(v-if="item.id === 'usedByRecordings'") {{ sections[1].value }}
        .tw-text-2xl.tw-font-medium.tw-ml-2(style="opacity: 0.7") GB
      v-progress-linear.tw-mt-3(:value="item.id === 'freeSpace' ? sections[0].value : sections[1].value" :buffer-value="maxSize" height="7" rounded color="var(--cui-primary)")
      .tw-flex.tw-justify-end
        .tw-text-base.tw-font-this.tw-font-xs(style="opacity: 0.5") {{ maxSize }} GB
</template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiReload } from '@mdi/js';

import { getDiskLoad } from '@/api/system.api';

export default {
  name: 'DiskWidget',

  props: {
    item: Object,
  },

  data() {
    return {
      loading: true,
      loadingDisk: true,

      icons: {
        mdiReload,
      },

      sections: [
        {
          id: 'free',
          label: this.$t('free_disk_space'),
          value: 0,
        },
        {
          id: 'rec',
          label: this.$t('recordings'),
          value: 0,
        },
      ],

      diskSpace: {},
      maxSize: 100.0,
    };
  },

  async mounted() {
    await this.reloadDiskSpace();

    this.loading = false;
  },

  beforeDestroy() {},

  methods: {
    async reloadDiskSpace() {
      this.loadingDisk = true;

      try {
        const response = await getDiskLoad();
        this.diskSpace = response.data;

        this.maxSize = (this.diskSpace.total || this.maxSize || 100).toFixed(2);
        this.sections[0].value = (this.diskSpace.available || 0).toFixed(2);
        this.sections[1].value = (this.diskSpace.usedRecordings || 0).toFixed(2);

        this.loadingDisk = false;
      } catch (err) {
        console.log(err);
      }
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
</style>
