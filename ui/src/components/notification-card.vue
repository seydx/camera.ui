<template lang="pug">
.swiper-container(:id="notification.id" v-click-outside="onClickOutside")
  .swiper-wrapper.tw-items-stretch
    .swiper-slide
      .tw-block.notification-card(:id="notification.id")
        v-card.tw-p-5(elevation="1" @click="$emit('show')")
          .tw-flex.tw-justify-between.tw-items-center.notifications-card-title
            v-card-title.tw-text-lg.tw-p-0 {{ notification.title || notification.camera || $t('notification') }}
              v-chip.tw-ml-2(x-small v-if="notification.label" :color="notification.label === 'Homebridge' ? 'purple' : 'grey'") {{ notification.label.includes("no label") ? $t("no_label") : notification.label.includes("Custom") ? $t("custom") : notification.label }}
              v-chip.tw-ml-2(x-small v-if="notification.type === 'ERROR'" color="error") {{ $t('error') }}
              v-chip.tw-ml-2(x-small v-if="notification.type === 'WARN'" color="yellow") {{ $t('warning') }}
            .tw-block
              v-icon.text-muted {{ icons['ClockTimeNineOutline'] }}
              span.tw-p-0.text-muted.tw-text-xs.tw-pt-4.tw-ml-2 {{ notification.time }}
          .tw-flex.tw-justify-start.tw-items-center.tw-mt-3
            .notifications-card-img.tw-mr-3(v-if="notification.recordStoring")
              v-img(:contain="errorImg" v-on:error="handleErrorImg" style="border-radius: 5px;" :src="src" width="40" max-width="40" min-width="40" height="40" max-height="40" min-height="40")
                template(v-slot:placeholder)
                  .tw-flex.tw-justify-center.tw-items-center.tw-h-full
                    v-progress-circular(indeterminate color="var(--cui-primary)" size="22")
            v-card-subtitle.tw-p-0.text-muted.tw-font-normal {{ notification.message }}
    .tw-flex.tw-justify-center.tw-items-center.swiper-slide.notification-card-remove
      v-btn(icon color="error" @click="remove")
        v-icon {{ icons['mdiCloseCircle'] }}
</template>

<script>
/* eslint-disable vue/require-default-prop */

import { mdiCloseCircle, mdiClockTimeNineOutline } from '@mdi/js';
import 'swiper/dist/css/swiper.min.css';
import { Swiper } from 'swiper/dist/js/swiper.esm.js';

export default {
  props: {
    notification: Object,
  },

  data() {
    return {
      test: true,
      errorImg: false,
      icons: {
        mdiCloseCircle,
        mdiClockTimeNineOutline,
      },
      src: `/files/${
        this.notification.recordType === 'Video' ? `${this.notification.name}@2.jpeg` : this.notification.fileName
      }`,
      swiper: null,
    };
  },

  mounted() {
    const self = this;
    const el = '#' + this.notification.id;

    // Initialize Swiper
    this.swiper = new Swiper(el, {
      slidesPerView: 'auto',
      initialSlide: 0,
      resistanceRatio: 0.6,
      on: {
        sliderFirstMove: function () {
          if (!this.isEnd && this.isBeginning) {
            self.$emit('slideStart', self.notification);
          }
        },
      },
    });
  },

  methods: {
    handleErrorImg() {
      this.errorImg = true;
      this.src = require('../assets/img/logo.png');
    },
    onClickOutside() {
      if (this.swiper?.isEnd) {
        this.swiper.slidePrev(100);
      }
    },
    remove() {
      if (this.swiper) {
        this.swiper.destroy();
        this.$emit('remove');
      }
    },
  },
};
</script>

<style scoped>
.swiper-container {
  overflow: unset !important;
}

.notification-card {
  border-radius: 4px;
}

.notifications-card-img {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 5px;
  border: 2px solid var(--cui-bg-card-border);
}

.notification-card-remove {
  max-width: 100px;
  height: unset;
}

@media (max-width: 459px) {
  .notifications-card-title {
    display: block !important;
  }
}

div >>> .v-image__image--contain {
  background-size: 60% !important;
}
</style>
