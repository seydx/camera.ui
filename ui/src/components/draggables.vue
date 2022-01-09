<template lang="pug">
.handles
  .handle(
    v-for="(coord, i) in coords"
    :key="i"
    :data-coord="coord.coordIndex"
    :data-region="coord.regionIndex"
    ref="draggable"
  )
    .delete-point

</template>

<script>
/* eslint-disable vue/require-default-prop */
import Draggabilly from 'draggabilly';

import { bus } from '@/main';

export default {
  name: 'Draggables',

  props: {
    regions: Array,
    width: Number,
    height: Number,
  },

  data() {
    return {
      coords: [],
      draggies: [],
    };
  },

  watch: {
    regions: {
      handler() {
        this.refreshCoords();
      },
      deep: true,
    },

    width() {
      this.resetHandles();
    },

    height() {
      this.resetHandles();
    },
  },

  created() {
    this.refreshCoords();
  },

  mounted() {
    setTimeout(() => {
      this.resetHandles();
    });

    bus.$on('handleAdded', this.handleAdded);

    bus.$on('customizingFinished', () => {
      this.$refs.draggable?.forEach((el) => this.makeDraggable(el));
    });

    bus.$on('clearDraggs', () => {
      this.coords = [];
    });
  },

  methods: {
    placeHandle(coord) {
      return {
        left: Math.round((coord[0] / 100) * this.width) + 'px',
        top: Math.round((coord[1] / 100) * this.height) + 'px',
      };
    },

    handleAdded(payload) {
      this.$nextTick(() => {
        let draggable = this.$refs.draggable?.filter(
          (el) => el.dataset.coord === payload.cIndex.toString() && el.dataset.region === payload.rIndex.toString()
        );
        this.styleHandle(draggable[0], payload.coord);
      });
    },

    resetHandles() {
      this.clearDraggies();

      this.$refs.draggable?.forEach((el) => {
        this.styleHandle(el, this.regions[el.dataset.region]?.coords[el.dataset.coord]);
        this.makeDraggable(el);
      });
    },

    clearDraggies() {
      this.draggies.forEach((draggie) => draggie.destroy());
      this.draggies = [];
    },

    styleHandle(el, coord) {
      if (!el || !coord) {
        return;
      }

      Object.assign(el.style, this.placeHandle(coord));
    },

    makeDraggable(el) {
      const self = this;

      el.classList.add('draggable');

      let draggie = new Draggabilly(el, {
        containment: true,
        grid: [0, 0],
      })
        .on('pointerDown', function () {
          document
            .querySelectorAll('[data-point="' + el.dataset.region + '-' + el.dataset.coord + '"]')[0]
            ?.classList.add('changing');
        })
        .on('dragMove', function () {
          let x = this.position.x;
          let y = this.position.y;
          self.$emit('updateHandle', { x: x, y: y, coordIndex: el.dataset.coord, regionIndex: el.dataset.region });
        })
        .on('pointerUp', function () {
          document.querySelectorAll('.point').forEach((point) => point.classList.remove('changing'));
        });

      this.draggies.push(draggie);
    },

    refreshCoords() {
      this.coords = [];

      this.regions.forEach((region, rIndex) => {
        region.coords.forEach((coord, cIndex) => {
          this.coords.push({
            regionIndex: rIndex,
            coordIndex: cIndex,
            ...coord,
          });
        });
      });
    },
  },
};
</script>

<style lang="scss">
.handles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;

  .delete-point,
  .handle {
    position: absolute;
    width: 20px;
    height: 20px;
  }

  .handle {
    border-radius: 50%;
    box-shadow: #fff inset 0 0 0 10px;
    opacity: 0.8;
    transition: opacity 0.25s;

    &.is-dragging,
    &.is-pointer-down {
      // better than using :hover/:active for touch
      z-index: 100;
      box-shadow: inset 0 0 0 3px;
      cursor: none;
      transition: box-shadow 0s;
    }

    &.draggable {
      cursor: grab;
    }

    &.show-delete {
      .delete-point {
        transform: scale3d(0.9, 0.9, 0.9);
        transition: transform 0.25s cubic-bezier(0.15, 1, 0.3, 1.1), opacity 0.25s;
        opacity: 1;
      }
    }

    &:after {
      display: block;
      content: '';
      position: absolute;
      top: -8px;
      left: -8px;
      right: -8px;
      bottom: -8px;
    }

    .delete-point {
      position: absolute;
      left: 22px;
      top: 0;
      width: 25px;
      padding-left: 5px;
      border-radius: 3px;
      background: #d3d0c9;
      transform: scale3d(0, 0, 0);
      transform-origin: left center;
      cursor: pointer;
      opacity: 0.75;
      clip-path: polygon(25% 0, 100% 1%, 100% 100%, 25% 100%, 0 50%);
      transition: transform 0.25s, opacity 0.25s;

      &:after {
        display: block;
        content: '';
        position: absolute;
        top: 4px;
        left: 9px;
        right: 4px;
        bottom: 4px;
        background: #100a09;
        clip-path: polygon(
          20% 10%,
          10% 20%,
          40% 50%,
          10% 80%,
          20% 90%,
          50% 60%,
          80% 90%,
          90% 80%,
          60% 50%,
          90% 20%,
          80% 10%,
          50% 40%
        );
      }
    }
  }
}

.playground:hover {
  .handle {
    opacity: 1;
  }
}

.playground.customizing .handle {
  pointer-events: none;
}
</style>
