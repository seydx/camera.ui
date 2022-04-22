<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-relative(v-else)
  .filter-button(ref="filterButton" @click="toggleFilter" v-click-outside="{ handler: hideFilter, include: include }")
    v-icon(size="20" color="white") {{ filterOpened ? icons['mdiChevronUp'] : icons['mdiChevronDown'] }}
  .filter.tw-flex.tw-items-center.tw-p-2(ref="filter" v-click-outside="{ handler: hideFilter, include: include }")
    span {{ $t('filter') }}
    v-combobox.tw-ml-3.selector(v-model="selectedFilter" background-color="var(--cui-bg-card)" :no-data-text="$t('no_data_available')" :items="filterData" item-value="key" item-text="key" :search-input.sync="search" prepend-inner-icon="mdi-filter" hide-selected label="..." multiple small-chips deletable-chips dense hide-details solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiFilter'] }}
      template(v-slot:no-data v-if="search")
        v-list-item
          v-list-item-content
            v-list-item-title 
              span {{ $t('no_label_matching') }} 
              strong "{{ search }}"
              span . {{ $t('press_enter_to_create').split(' %')[0] }} 
              kbd {{ $t('press_enter_to_create').split(' %')[1].split('% ')[0] }}
              span  {{ $t('press_enter_to_create').split('% ')[1] }} 
  .console-container.tw-relative
    #log.tw-relative.tw-h-full
      .utils.tw-flex.tw-justify-between.tw-items-center
        .remove-btn.tw-block.tw-ml-auto
          v-btn.tw-text-white.tw-mr-1(fab height="40px" width="40px" color="rgba(var(--cui-primary-rgb))" @click="onRemove" :loading="loadingRemove")
            v-icon.tw-text-white {{ icons['mdiDeleteEmpty'] }}
        .dl-btn.tw-block.tw-ml-1
          v-btn.tw-text-white.tw-mr-1(fab height="40px" width="40px" color="rgba(var(--cui-primary-rgb))" @click="onDownload" :loading="loadingDownload")
            v-icon.tw-text-white {{ icons['mdiDownload'] }}
        .share-btn.tw-block.tw-ml-1(v-if="showShare")
          v-btn.tw-text-white.tw-mr-1(fab height="40px" width="40px" color="rgba(var(--cui-primary-rgb))" @click="onShare" :loading="loadingShare")
            v-icon.tw-text-white {{ icons['mdiShareVariant'] }}
      
      my-terminal(:terminal="terminal" :filter="selectedFilter" ref="xterm")

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
import { mdiChevronDown, mdiChevronUp, mdiDeleteEmpty, mdiDownload, mdiFilter, mdiShareVariant } from '@mdi/js';

import { getCameras } from '@/api/cameras.api';
import { downloadLog, removeLog } from '@/api/system.api';
import socket from '@/mixins/socket';

import Console from '@/components/console.vue';

export default {
  name: 'Console',

  components: {
    LightBox,
    'my-terminal': Console,
  },

  mixins: [socket],

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  data: () => ({
    icons: {
      mdiChevronDown,
      mdiChevronUp,
      mdiDeleteEmpty,
      mdiDownload,
      mdiFilter,
      mdiShareVariant,
    },

    filterData: ['HTTP', 'FTP', 'SMTP', 'MQTT', 'Videoanalysis'],

    search: null,
    selectedFilter: [],

    loading: true,
    loadingDownload: false,
    loadingRemove: false,
    loadingShare: false,

    showShare: true,
    terminal: {
      pid: 1,
      name: 'terminal',
    },

    filterOpened: false,
  }),

  created() {
    this.showShare = navigator.share ? true : false;
  },

  async mounted() {
    const response = await getCameras();

    response.data.result.forEach((camera) => {
      this.filterData.push(camera.name);
    });

    this.loading = false;
  },

  methods: {
    include() {
      return [
        ...document.querySelectorAll('.filter-button'),
        ...document.querySelectorAll('.filter'),
        ...document.querySelectorAll('.v-menu__content'),
      ];
    },
    hideFilter() {
      if (this.filterOpened) {
        this.filterOpened = false;

        this.$refs.filter?.classList.remove('filter-open');
        this.$refs.filterButton?.classList.remove('filter-button-open');
      }
    },
    async onDownload() {
      this.loadingDownload = true;

      try {
        const response = await downloadLog();
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'camera.ui.log.txt');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingDownload = false;
    },
    async onRemove() {
      this.loadingRemove = true;

      try {
        await removeLog();
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingRemove = false;
    },
    async onShare() {
      this.loadingShare = true;

      try {
        const response = await downloadLog();
        const blob = new Blob([response.data], { type: 'text/plain' });

        const data = {
          title: this.$t('log'),
          text: `${this.$t('log')} - ${new Date()}`,
          files: [new File([blob], 'camera.ui.log.txt', { type: blob.type })],
        };

        navigator.share(data).catch((err) => {
          if (err?.message !== 'Abort due to cancellation of share.') {
            console.log(err);
            this.$toast.error(err.message);
          }
        });
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingShare = false;
    },
    toggleFilter() {
      if (this.filterOpened) {
        this.$refs.filter?.classList.remove('filter-open');
        this.$refs.filterButton?.classList.remove('filter-button-open');
      } else {
        this.$refs.filter?.classList.add('filter-open');
        this.$refs.filterButton?.classList.add('filter-button-open');
      }

      this.filterOpened = !this.filterOpened;
    },
  },
};
</script>

<style scoped>
.console-container {
  margin-top: 3px;
  background: #000;
  overflow: hidden;
  height: calc(100vh - 64px - 44px - env(safe-area-inset-top, 0px));
  border: 1px solid rgba(var(--cui-bg-app-bar-border-rgb));
  padding-top: 10px;
  padding-bottom: 10px;
  padding-left: clamp(10px, env(safe-area-inset-left, 10px), env(safe-area-inset-left, 10px));
  padding-right: clamp(10px, env(safe-area-inset-left, 10px), env(safe-area-inset-right, 10px));
}

.utils {
  position: absolute;
  height: 40px;
  top: 10px;
  right: clamp(10px, env(safe-area-inset-left, 10px), env(safe-area-inset-right, 10px));
  z-index: 10;
}

.remove-btn,
.dl-btn,
.share-btn {
  opacity: 0.2;
  transition: 0.3s all;
}

.remove-btn:hover,
.dl-btn:hover,
.share-btn:hover {
  opacity: 1;
}

div >>> .xterm .xterm-viewport {
  width: 100% !important;
}

.filter {
  height: 50px;
  background: var(--cui-primary);
  color: #fff !important;
  position: absolute;
  left: 0;
  right: 0;
  top: -47px;
  z-index: 11;
  transition: 0.3s all;
}

.filter-open {
  top: 0px;
}

.filter-button {
  height: 25px;
  width: 30px;
  background: var(--cui-primary);
  color: #fff !important;
  position: absolute;
  left: 10px;
  top: -2px;
  z-index: 11;
  border-bottom-left-radius: 5px;
  border-bottom-right-radius: 5px;
  transition: 0.3s all;
  cursor: pointer;
  text-align: center;
}

.filter-button-open {
  top: 45px;
}

div >>> .v-chip__content {
  color: #fff !important;
}
</style>
