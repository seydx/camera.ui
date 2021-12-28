<template lang="pug">
div
  .grid-stack-item(v-for="placeholder in placeholders" :key="placeholder.id" :gs-id="placeholder.id" :gs-type="placeholder.type" :gs-w="placeholder.w" :gs-min-w="placeholder.minW" :gs-max-w="placeholder.maxW" :gs-h="placeholder.h" :gs-min-h="placeholder.minH" :gs-max-h="placeholder.maxH" :gs-no-resize="placeholder.disableResize" :gs-no-move="placeholder.disableDrag")
    .grid-stack-item-content
      .content.tw-p-4.tw-relative.tw-flex.tw-flex-col.tw-items-center.tw-justify-center
        .tw-flex.tw-items-center.tw-justify-center
          .tw-block
            v-icon.tw-mr-1(size="44" color="var(--cui-primary)") {{ icons['mdiCloudUpload'] }}
          .tw-mx-2
          .tw-block.tw-mx-auto
            .placeholder-card-text.placeholder.tw-mt-0(style="aspect-ratio: 10/1; height: 10px;")
            .placeholder-card-text.placeholder.tw-mt-2(style="aspect-ratio: 5/1; height: 6px; background: rgba(var(--cui-text-hint-rgb), 0.5);")
</template>

<script>
/* eslint-disable vue/require-default-prop */

import { mdiCloudUpload } from '@mdi/js';

export default {
  name: 'StatusPlaceholder',

  props: {
    items: Array,
    dataset: Object,
    widgets: Array,
    type: String,
  },

  data: () => ({
    icons: {
      mdiCloudUpload,
    },

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

.placeholder-card-text {
  aspect-ratio: 10 / 1;
  margin-top: 1rem;
  margin-bottom: 0;
}

.placeholder {
  background: var(--cui-text-hint);
  border-radius: 1rem;
  position: relative;
  overflow: hidden;
}
</style>
