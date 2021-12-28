<template lang="pug">
div
  .grid-stack-item(v-for="placeholder in placeholders" :key="placeholder.id" :gs-id="placeholder.id" :gs-type="placeholder.type" :gs-w="placeholder.w" :gs-min-w="placeholder.minW" :gs-max-w="placeholder.maxW" :gs-h="placeholder.h" :gs-min-h="placeholder.minH" :gs-max-h="placeholder.maxH" :gs-no-resize="placeholder.disableResize" :gs-no-move="placeholder.disableDrag")
    .grid-stack-item-content
      .content.tw-relative
        v-card-title.card-top-title.tw-flex.tw-justify-between.tw-items-center
          span.font-weight-bold.text-truncate.text-default {{ $t('log') }}
        .tw-block.tw-h-full
          .placeholder-card.tw-h-full
            .placeholder-card-text.placeholder.tw-mt-3(style="width: 100%; height: 10px;")
            .placeholder-card-text.placeholder(style="width: 80%; height: 10px;")
            .placeholder-card-text.placeholder(style="width: 90%; height: 10px;")
            .placeholder-card-text.placeholder(style="width: 50%; height: 10px;")
            .placeholder-card-text.placeholder.tw-mt-10(style="width: 100%; height: 10px;")
            .placeholder-card-text.placeholder(style="width: 40%; height: 10px;")
            .placeholder-card-text.placeholder.tw-mt-10(style="width: 30%; height: 10px;")
            .placeholder-card-text.placeholder.tw-mb-3(style="width: 100%; height: 10px;")
            
</template>

<script>
/* eslint-disable vue/require-default-prop */

export default {
  name: 'ConsolePlaceholder',

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
  box-sizing: border-box;
  background: rgb(0, 0, 0);
  border-bottom-left-radius: 13px;
  border-bottom-right-radius: 13px;
}

.placeholder {
  background: rgb(65, 65, 65);
  border-radius: 1rem;
  position: relative;
  overflow: hidden;
}

.placeholder-card-text {
  aspect-ratio: 16 / 1;
  margin-top: 1rem;
  margin-bottom: 0;
}
</style>
