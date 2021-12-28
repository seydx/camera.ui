<template lang="pug">
div
  .grid-stack-item(v-for="placeholder in placeholders" :key="placeholder.id" :gs-id="placeholder.id" :gs-type="placeholder.type" :gs-w="placeholder.w" :gs-min-w="placeholder.minW" :gs-max-w="placeholder.maxW" :gs-h="placeholder.h" :gs-min-h="placeholder.minH" :gs-max-h="placeholder.maxH" :gs-no-resize="placeholder.disableResize" :gs-no-move="placeholder.disableDrag")
    .grid-stack-item-content
      .notifications-card.tw-relative.tw-mx-auto(style="z-index: 3;")
        .placeholder-card-text.placeholder.tw-mt-0(style="width: 100%; height: 10px;")
        .placeholder-card-text.placeholder(style="width: 60%; height: 7px;")
        .placeholder-card-text.placeholder.tw-mt-1(style="width: 60%; height: 7px;")

      .notifications-card.tw-relative.tw-mx-auto(style="z-index: 2; margin-top: -70px; width: 95%; opacity: 0.9;")
        .placeholder-card-text.placeholder.tw-mt-0(style="width: 100%; height: 10px;")
        .placeholder-card-text.placeholder(style="width: 60%; height: 7px;")
        .placeholder-card-text.placeholder.tw-mt-1(style="width: 60%; height: 7px;")

      .notifications-card.tw-relative.tw-mx-auto(style="z-index: 1; margin-top: -70px; width: 90%; opacity: 0.8;")
        .placeholder-card-text.placeholder.tw-mt-0(style="width: 100%; height: 10px;")
        .placeholder-card-text.placeholder(style="width: 60%; height: 7px;")
        .placeholder-card-text.placeholder.tw-mt-1(style="width: 60%; height: 7px;")
            
</template>

<script>
/* eslint-disable vue/require-default-prop */

export default {
  name: 'NotificationsPlaceholder',

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
  background: var(--cui-bg-default);
  border-radius: 13px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
}

.notifications-card {
  padding: 1rem;
  border-radius: 15px;
  background: var(--cui-bg-card);
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
}

.placeholder {
  background: var(--cui-text-hint);
  border-radius: 1rem;
  position: relative;
  overflow: hidden;
}

.placeholder-card-title {
  aspect-ratio: 16 / 1.5;
  margin-bottom: 2rem;
}

.placeholder-card-text {
  aspect-ratio: 16 / 1;
  margin-top: 1rem;
  margin-bottom: 0;
}

.placeholder-card-img {
  aspect-ratio: 16 / 12;
  margin-bottom: 1rem;
}
</style>
