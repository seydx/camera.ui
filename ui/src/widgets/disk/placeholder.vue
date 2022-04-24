<template lang="pug">
div
  .grid-stack-item(v-for="(placeholder, i) in placeholders" :key="placeholder.id" :gs-id="placeholder.id" :gs-type="placeholder.type" :gs-w="placeholder.w" :gs-min-w="placeholder.minW" :gs-max-w="placeholder.maxW" :gs-h="placeholder.h" :gs-min-h="placeholder.minH" :gs-max-h="placeholder.maxH" :gs-no-resize="placeholder.disableResize" :gs-no-move="placeholder.disableDrag")
    .grid-stack-item-content
      .content.tw-relative.tw-overflow-hidden(:class="i !== placeholders.length - 1 ? 'tw-mb-3' : ''")
        .tw-w-full.tw-p-6.disk-card
          .tw-text-xs.tw-p-0.v-text-field__suffix(v-if="placeholder.id === 'freeSpace'") {{ $t("free_disk_space") }}
          .tw-text-xs.tw-p-0.v-text-field__suffix(v-if="placeholder.id === 'usedByRecordings'") {{ $t("recordings") }}
          .tw-h-full.tw-w-full
            .tw-flex.tw-items-end
              .tw-text-5xl.tw-font-black.tw-mt-2.text-default(v-if="placeholder.id === 'freeSpace'") 70
              .tw-text-5xl.tw-font-black.tw-mt-2.text-default(v-if="placeholder.id === 'usedByRecordings'") 5
              .tw-text-2xl.tw-font-medium.tw-ml-2(style="opacity: 0.7") GB
            v-progress-linear.tw-mt-3(:value="placeholder.id === 'freeSpace' ? 70 : 5" :buffer-value="100" height="7" rounded color="var(--cui-primary)")
            .tw-flex.tw-justify-end
              .tw-text-base.tw-font-this.tw-font-xs(style="opacity: 0.5") 100 GB

</template>

<script>
/* eslint-disable vue/require-default-prop */

export default {
  name: 'DiskPlaceholder',

  props: {
    items: Array,
    dataset: Object,
    widgets: Array,
    type: String,
  },

  data: () => ({
    placeholders: [],
  }),

  watch: {
    items: {
      handler() {
        const placeholders = [];

        this.widgets.forEach((widget) => {
          const itemDropped = this.items.some((item) => item.id === widget.id);

          if (!itemDropped) {
            placeholders.push({
              id: widget.id,
              type: this.type,
              ...this.dataset,
            });
          }
        });

        this.placeholders = placeholders;
      },
      deep: true,
    },
  },

  mounted() {
    this.widgets.forEach((widget) => {
      const itemDropped = this.items.some((item) => item.id === widget.id);

      if (!itemDropped) {
        this.placeholders.push({
          id: widget.id,
          type: this.type,
          ...this.dataset,
        });
      }
    });
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  min-height: 100px;
  background: var(--cui-bg-default);
  border-radius: 10px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
}

.widget {
  min-height: 80px;
}
</style>
