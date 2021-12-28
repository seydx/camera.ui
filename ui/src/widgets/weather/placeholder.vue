<template lang="pug">
div
  .grid-stack-item(v-for="placeholder in placeholders" :key="placeholder.id" :gs-id="placeholder.id" :gs-type="placeholder.type" :gs-w="placeholder.w" :gs-min-w="placeholder.minW" :gs-max-w="placeholder.maxW" :gs-h="placeholder.h" :gs-min-h="placeholder.minH" :gs-max-h="placeholder.maxH" :gs-no-resize="placeholder.disableResize" :gs-no-move="placeholder.disableDrag")
    .grid-stack-item-content
      .content.tw-p-4.tw-relative.tw-flex.tw-flex-col.tw-items-start.tw-justify-center
        .weatherTitle {{ $t('sunny') }}
        .weatherBox.tw-flex.tw-flex-row
          .weatherDegree.tw-flex.tw-items-center.tw-justify-center 25°
          .divider.tw-mx-3
          .tw-block.tw-flex.tw-flex-col.tw-justify-center
            .weatherDate {{ $t('monday') }}, 21 {{ $t('september') }}
            .weatherLocation 
              v-icon.tw-mr-1(size="12" color="rgba(255, 255, 255, 0.5)" style="margin-bottom: 2px;") {{ icons['mdiMapMarker'] }}
              span Berlin
        .sun

</template>

<script>
/* eslint-disable vue/require-default-prop */

import { mdiMapMarker } from '@mdi/js';

export default {
  name: 'WeatherPlaceholder',

  props: {
    items: Array,
    dataset: Object,
    widgets: Array,
    type: String,
  },

  data: () => ({
    icons: {
      mdiMapMarker,
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

<style>
.testMsg {
  color: red;
}
</style>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  background: rgb(32, 148, 253);
  background: linear-gradient(90deg, rgba(32, 148, 253, 1) 0%, rgba(90, 185, 254, 1) 100%);
  border-radius: 10px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
}

.widget {
  min-height: 80px;
}

.divider {
  width: 1px;
  height: 100%;
  background: rgb(255, 255, 255);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0) 100%
  );
}

.weatherTitle {
  font-size: 0.75rem;
  color: #fff;
}

.weatherBox {
  height: 50px;
  z-index: 2;
}

.weatherDegree {
  font-size: 1.75rem;
  font-weight: bold;
  color: #fff;
}

.weatherDate {
  font-size: 0.75rem;
  color: #fff;
}

.weatherLocation {
  font-size: 0.9rem;
  font-weight: 500;
  color: #fff;
}

.sun {
  position: absolute;
  transform: translateY(-50%);
  top: 50%;
  height: 50px;
  width: 50px;
  border-radius: 50%;
  right: 20px;
  background: #efb76f;
  box-shadow: 0 0 0 5px rgba(255, 158, 45, 0.1), 0 0 0 10px rgba(255, 158, 45, 0.05), 0 0 0 15px rgba(255, 158, 45, 0.1);
  animation: ray 1s infinite;
  z-index: 1;
}

@keyframes ray {
  0% {
    box-shadow: 0 0 0 5px rgba(255, 158, 45, 0.1), 0 0 0 10px rgba(255, 158, 45, 0.05),
      0 0 0 15px rgba(255, 158, 45, 0.1);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(255, 158, 45, 0.1), 0 0 0 15px rgba(255, 158, 45, 0.05),
      0 0 0 20px rgba(255, 158, 45, 0.1);
  }
  100% {
    box-shadow: 0 0 0 5px rgba(255, 158, 45, 0.1), 0 0 0 10px rgba(255, 158, 45, 0.05),
      0 0 0 15px rgba(255, 158, 45, 0.1);
  }
}
</style>
