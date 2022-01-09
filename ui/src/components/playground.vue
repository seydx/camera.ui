<template lang="pug">
  #playground_container.playground-container.flex
    section.playground(:class="{ customizing: customizing, start: !regions.length }" @click="addHandle")
      .sandbox(:style="{ width: width + 20 + 'px', height: height + 20 + 'px' }")
        draggables(:regions="regions" :width="width" :height="height" @updateHandle="updateHandle")
        .shadowboard.on(:style="background")
        .clipboard(v-for="(region, i) in regions" :key="`clipboard-${i}`" :style="[{ 'clip-path': clipCSS(region.coords) }, { '-webkit-clip-path': clipCSS(region.coords) }, background]")

</template>

<script>
/* eslint-disable vue/require-default-prop */
import { clipCSS } from '@/common/clips';
import draggables from '@/components/draggables.vue';

export default {
  name: 'Playground',

  components: {
    draggables: draggables,
  },

  props: {
    options: Object,
    customizing: Boolean,
    regions: Array,
    width: Number,
    height: Number,
  },

  computed: {
    background() {
      return { 'background-image': 'url(' + this.options.background + ')' };
    },
  },

  methods: {
    clipCSS,

    updateHandle(payload) {
      this.$emit('updateHandle', payload);
    },

    addHandle(e) {
      if (this.customizing) {
        this.$emit('addHandle', e);
      }
    },
  },
};
</script>

<style lang="scss">
.playground-container {
  justify-content: center;
  flex: 1;
  position: relative;
  z-index: 100;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;

  @media (min-width: 800px) {
    border-radius: 0 0 2px 2px;
  }

  .playground {
    position: relative;

    &.customizing {
      cursor: crosshair;
    }

    &.start {
      .custom-notice {
        opacity: 1;
      }
    }

    .custom-notice {
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 1rem;
      pointer-events: none;
      opacity: 0;
      transition: background 0.25s;
      background: rgba(255, 255, 255, 0);
      div {
        width: 100%;
        text-align: center;
        background: rgba(255, 255, 255, 0.9);
        padding: 1rem;
        margin: 0 2rem;
        transition: opacity 0.25s;
        border-radius: 2px;
        box-shadow: 0 1px 2px rgba(16, 10, 9, 0.15);
        opacity: 1;

        .touchy {
          &:after {
            content: 'Click';
          }
        }
      }
    }

    .sandbox {
      position: relative;
      touch-action: none;

      .clipboard,
      .shadowboard {
        position: absolute;
        top: 10px;
        left: 10px;
        right: 10px;
        bottom: 10px;
        background: #000 center center;
        background-size: cover;
      }

      .shadowboard {
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.375s;

        &.on {
          opacity: 0.25;
        }
      }
    }
  }
}
</style>
