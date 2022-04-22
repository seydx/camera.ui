<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .pl-safe.pr-safe

    .tw-flex.tw-justify-between
      .header-title.tw-flex.tw-items-center
        .page-title {{ $t($route.name.toLowerCase()) }}

    span.text-muted coming soon...

    .tw-mt-5.tw-max-w-4xl
      v-card-text.py-0
          v-timeline(dense clipped)
            v-slide-x-reverse-transition(group hide-on-leave)
              v-timeline-item(v-for="item in items" :key="item.id" small fill-dot)
                v-chip.tw-text-white(color="var(--cui-primary)" small) Security Alert
                
                .tw-p-3 Lorem ipsum dolor sit amet, no nam oblique veritus. Commune scaevola imperdiet nec ut, sed euismod convenire principes at. Est et nobis iisque percipit, an vim zril disputando voluptatibus, vix an salutandi sententiae.

                template(v-slot:icon)
                  v-icon(size="30" color="var(--cui-primary)") {{ icons['mdiCircle'] }}

                template(v-slot:opposite)
                  span {{ item.time }}
      
  </v-card>

  LightBox(
    ref="lightboxBanner"
    :media="notImages"
    :showLightBox="false"
    :showThumbs="false"
    showCaption
    disableScroll
  )

</template>

<script>
import LightBox from 'vue-it-bigger';
import 'vue-it-bigger/dist/vue-it-bigger.min.css';
import { mdiCircle } from '@mdi/js';

import socket from '@/mixins/socket';

export default {
  name: 'Timeline',

  components: {
    LightBox,
  },

  mixins: [socket],

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  data() {
    return {
      loading: true,

      icons: {
        mdiCircle,
      },

      items: [
        {
          id: 1,
          time: '1 month ago',
        },
        {
          id: 2,
          time: '2 month ago',
        },
        {
          id: 3,
          time: '3 month ago',
        },
        {
          id: 4,
          time: '4 month ago',
        },
        {
          id: 5,
          time: '5 month ago',
        },
      ],
    };
  },

  mounted() {
    this.loading = false;
  },
};
</script>

<style scoped>
.page-title {
  font-size: 1.3rem !important;
  letter-spacing: -0.025em !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
}

div >>> .v-timeline--dense .v-timeline-item__opposite {
  display: block !important;
  position: relative !important;
  align-self: auto;
}

div >>> .v-timeline--dense .v-timeline-item__opposite span {
  position: absolute;
  top: 0;
  left: 0;
  width: 100px;
}

div >>> .v-timeline--dense:not(.v-timeline--reverse):before {
  left: calc(48px - 1px + 55px) !important;
  background: rgba(102, 102, 102, 0.12);
}

div >>> .v-timeline-item__divider {
  margin-left: 55px !important;
}

div >>> .v-timeline-item__divider {
  align-items: start !important;
}
</style>
