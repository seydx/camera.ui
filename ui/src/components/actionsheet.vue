<template lang="pug">
transition(name="fade" @enter="enter")
  div(v-if="showButton")
    .wrapper.add-new-item.d-flex.flex-wrap.justify-content-center.align-content-center.add-new-item-hover.pulse(@click="show = !show")
      b-icon.add-icon.show-icon(icon="gear-wide-connected", animation="spin", aria-hidden="true")
    b-modal(v-model="show" modal-class="overflow-hidden" dialog-class="modal-bottom" hide-footer hide-header)
      .row.pb-4(v-if="showLeftNavi || showRightNavi || showMiddleNavi")
        .col.d-flex.flex-wrap.justify-content-start.align-content-center(v-if="showLeftNavi")
          b-button.left-button(pill, @click="$emit('leftNaviClick')") {{ leftNaviName }}
        .col.d-flex.flex-wrap.justify-content-center.align-content-center(v-if="showMiddleNavi")
          b-button.middle-button(pill, @click="$emit('middleNaviClick')") {{ middleNaviName }}
        .col.d-flex.flex-wrap.justify-content-end.align-content-center(v-if="showRightNavi")
          b-button.btn-primary.right-button(pill, @click="$emit('rightNaviClick')") {{ rightNaviName }}
      hr.mt-0.pt-0(v-if="showLeftNavi || showRightNavi || showMiddleNavi")
      div(v-for="(item, i) in items" :key="item.name")
        .row
          .col.d-flex.flex-wrap.align-content-center {{ item.name }}
          .col.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
            toggle-button(
              v-model="item[state]"
              color="var(--primary-color) !important",
              :height="30",
              :sync="true"
              @change="$emit('changeState', { name: item.name, state: item[state] })"
            )
        hr(v-if="i !== (items.length - 1)")
        div.safe-height(v-else)
</template>

<script>
import { BIcon, BIconGearWideConnected } from 'bootstrap-vue';
import { ToggleButton } from 'vue-js-toggle-button';

export default {
  name: 'AddCamera',
  components: {
    BIcon,
    BIconGearWideConnected,
    ToggleButton,
  },
  props: {
    items: {
      type: Array,
      required: true,
    },
    leftNaviName: {
      type: String,
      default: 'Back',
    },
    middleNaviName: {
      type: String,
      default: 'Fullscreen',
    },
    rightNaviName: {
      type: String,
      default: 'Signout',
    },
    showLeftNavi: {
      type: Boolean,
      default: false,
    },
    showMiddleNavi: {
      type: Boolean,
      default: false,
    },
    showRightNavi: {
      type: Boolean,
      default: false,
    },
    state: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      show: false,
      showButton: false,
    };
  },
  watch: {
    show(newVal) {
      if (newVal) {
        if (this.fadeOutTimer) {
          clearTimeout(this.fadeOutTimer);
          this.fadeOutTimer = null;
        }
      } else {
        this.enter();
      }
    },
  },
  beforeDestroy() {
    document.removeEventListener('click', this.clickHandler);
  },
  mounted() {
    document.addEventListener('click', this.clickHandler);

    setTimeout(() => (this.showButton = true), 250);
  },
  methods: {
    clickHandler(event) {
      const clickArea = event.target;
      const toggleClickArea = clickArea.classList.contains('toggleArea');

      if (toggleClickArea) {
        if (!this.showButton) {
          this.showButton = true;
          this.enter();
        } else {
          this.showButton = false;
        }
      }
    },
    enter() {
      if (this.fadeOutTimer) {
        clearTimeout(this.fadeOutTimer);
        this.fadeOutTimer = null;
      }

      this.fadeOutTimer = setTimeout(() => (this.showButton = false), 10000);
    },
    handleShow() {
      this.show = !this.show;
      this.enter();
    },
  },
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
  z-index: 9;
}

.fade-enter,
.fade-leave-to
/* .fade-leave-active in <2.1.8 */ {
  z-index: 9;
  opacity: 0;
}

.wrapper {
  position: fixed;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}

.add-new-item {
  z-index: 2;
  width: 16px;
  height: 16px;
  border-radius: 9px;
  background: var(--primary-color);
  transition: 0.3s all;
  cursor: pointer;
  opacity: 0.3;
  color: #fff;
}

.add-new-item-hover {
  opacity: 1;
  bottom: 68px;
  width: 50px;
  height: 50px;
  border-radius: 26px;
}

.add-icon {
  opacity: 0;
  transition: 0.3s all;
  font-size: 1.4rem;
  color: #fff;
}

.show-icon {
  opacity: 1;
}

.item-list {
  position: fixed;
  bottom: 62px;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 9px;
  background: var(--primary-color);
  color: var(--primary-font-color);
  z-index: 1;
  transition: 0.3s all;
  height: 200px;
  width: 300px;
}

.safe-height {
  height: env(safe-area-inset-bottom) !important;
}

.b-icon.b-icon-animation-spin,
.b-icon.b-iconstack .b-icon-animation-spin > g {
  transform-origin: center;
  -webkit-animation: 4s infinite linear normal b-icon-animation-spin;
  animation: 4s infinite linear normal b-icon-animation-spin;
}
</style>
