<template lang="pug">
v-carousel.carousel(v-model="camera" height="200" hide-delimiters)
  template(v-slot:prev)
    v-btn(icon @click="changeCamera(-1)" v-if="placeholders.length > 1")
      v-icon.tw-text-white {{ icons['mdiChevronLeft'] }}
    span(v-else)
  template(v-slot:next)
    v-btn(icon @click="changeCamera(+1)" v-if="placeholders.length > 1")
      v-icon.tw-text-white {{ icons['mdiChevronRight'] }}
    span(v-else)
  v-carousel-item(v-for="(placeholder,i) in placeholders" :key="i" reverse-transition="fade-transition" transition="fade-transition")
    .grid-stack-item(:gs-id="placeholder.id" :gs-type="placeholder.type" :gs-w="placeholder.w" :gs-min-w="placeholder.minW" :gs-max-w="placeholder.maxW" :gs-h="placeholder.h" :gs-min-h="placeholder.minH" :gs-max-h="placeholder.maxH" :gs-no-resize="placeholder.disableResize" :gs-no-move="placeholder.disableDrag")
      .grid-stack-item-content
        .content.tw-overflow-hidden.tw-relative
          .widget
          
            .tw-block
              v-card-title.video-card-top-title.tw-flex.tw-justify-between.tw-items-center
                span.font-weight-bold.text-truncate.text-default {{ placeholder.id }}
                v-badge(dot inline color="red")
              v-divider
            
</template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiChevronLeft, mdiChevronRight } from '@mdi/js';

export default {
  name: 'CameraPlaceholder',

  props: {
    items: Array,
    dataset: Object,
    widgets: Array,
    type: String,
  },

  data: () => ({
    camera: 0,

    icons: {
      mdiChevronLeft,
      mdiChevronRight,
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

    this.loading = false;
  },

  methods: {
    changeCamera(i) {
      this.camera += i;

      if (this.camera > this.placeholders.length - 1) {
        this.camera = 0;
      } else if (this.camera < 0) {
        this.camera = this.placeholders.length - 1;
      }

      setTimeout(() => this.$emit('refreshDrag'), 100);
    },
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  min-height: 200px;
  border-radius: 13px;
  background: rgb(17, 17, 17);
  border: 1px solid var(--cui-bg-app-bar-border);
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

.carousel {
  background: rgb(17, 17, 17);
  border-radius: 13px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
}

div >>> .v-window__prev,
div >>> .v-window__next {
  margin-top: 15px;
}
</style>
