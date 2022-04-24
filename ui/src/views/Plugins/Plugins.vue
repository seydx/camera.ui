<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .pl-safe.pr-safe

    .header.tw-flex.tw-justify-between.tw-items-center
      .header-title
        .page-title.tw-m-0 {{ $t($route.name.toLowerCase()) }}
        span.tw-text-xs.text-muted DEMO

      v-text-field.search-field.tw-ml-5(v-model="searchTxt" hide-details label="camera-ui-" prepend-inner-icon="mdi-magnify" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiMagnify'] }}

    .tw-mt-5
      v-layout(row wrap)
        v-flex.tw-p-2(xs12 sm12 md6 lg4 xl3 v-for="plugin in plugins" :key="plugin.id")
          v-card.plugin-card.tw-w-full.tw-h-full.tw-p-6.tw-flex.tw-flex-col.tw-justify-between(elevation="1" style="border-radius: 10px")
            .tw-block
              .tw-flex.tw-justify-between
                v-card-title.tw-p-0.tw-font-bold {{ plugin.name }}
                span.tw-text-xs.text-primary Installed
              v-card-subtitle.tw-p-0.tw-mt-0.text-muted {{ plugin.pkgName }} • v{{ plugin.version }}
                | • 
                span.tw-text-xs(style="color: #31d05a") Update available
            v-card-actions.tw-p-0.tw-flex.tw-justify-between.tw-items-center.tw-mt-3
              .tw-block
                .tw-text-sm.tw-font-semibold Details | Uninstall
              .tw-block
                v-btn.tw-mr-2(fab x-small color="var(--cui-primary)")
                  v-icon(size="20" color="white") {{ icons["mdiCogs"] }}
                v-btn(fab x-small color="var(--cui-primary)")
                  v-icon(size="20" color="white") {{ icons["mdiOpenInNew"] }}

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
import { mdiCogs, mdiMagnify, mdiOpenInNew } from '@mdi/js';
import VueAspectRatio from 'vue-aspect-ratio';

import socket from '@/mixins/socket';

export default {
  name: 'Plugins',

  components: {
    LightBox,
    'vue-aspect-ratio': VueAspectRatio,
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
        mdiCogs,
        mdiMagnify,
        mdiOpenInNew,
      },

      searchTxt: '',

      plugins: [
        {
          id: 1,
          name: 'Unifi',
          pkgName: 'camera-ui-unifi',
          description: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr...',
          version: '0.0.1',
          downloads: 543,
        },
        {
          id: 2,
          name: 'Ring',
          pkgName: 'camera-ui-ring',
          description: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr...',
          version: '1.0.1',
          downloads: 123,
        },
        {
          id: 3,
          name: 'Unifi',
          pkgName: 'camera-ui-unifi',
          description: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr...',
          version: '2.1.1',
          downloads: 5523,
        },
        {
          id: 4,
          name: 'Ring',
          pkgName: 'camera-ui-ring',
          description: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr...',
          version: '1.0.0',
          downloads: 11,
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

.plugin-card {
  background: var(--cui-bg-card) !important;
  transition: 0.3s all;
}

.plugin-card:hover {
  background: var(--cui-bg-settings-border) !important;
}

@media (max-width: 500px) {
  .header {
    display: block !important;
  }

  .search-field {
    margin-left: 0 !important;
    margin-top: 1rem !important;
  }
}
</style>
