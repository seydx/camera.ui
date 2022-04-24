<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .tw-flex.tw-relative.pl-safe.pr-safe

    Sidebar(camerasSelect datePicker labelSelect roomSelect typeSelect @filter="filter")

    .overlay(v-if="showOverlay")

    .filter-content.filter-included.tw-w-full.tw-relative
      .tw-flex.tw-justify-between
        .header-title.tw-flex.tw-items-center
          v-btn.included.filter-nav-toggle(@click="toggleFilterNavi" icon height="38px" width="38px" :color="selectedFilter.length ? 'var(--cui-primary)' : 'var(--cui-text-default)'")
            v-icon {{ icons['mdiFilter'] }}
          v-badge(overlap :content="totalRecordings.toString()" offset-x="0")
            .page-title {{ $t($route.name.toLowerCase()) }}
        .header-utils.tw-flex.tw-justify-center.tw-items-center
          v-btn.tw-mr-1(v-if="showListOptions" icon height="35px" width="35px" :color="listMode ? 'var(--cui-primary)' : 'grey'" @click="changeListView(1)")
            v-icon(size="25") {{ icons['mdiFormatListBulleted'] }}
          v-btn.tw-mr-3(v-if="showListOptions" icon height="35px" width="35px" :color="!listMode ? 'var(--cui-primary)' : 'grey'" @click="changeListView(2)")
            v-icon(size="25") {{ icons['mdiViewModule'] }}
          v-btn(fab elevation="1" height="35px" width="35px" color="red" :disabled="!selected.length" @click="remove")
            v-badge(v-if="selected.length" :content="selected.length > 999 ? '999+' : selected.length" overlap offset-x="9" offset-y="10" color="grey")
              v-icon(size="20" color="white") {{ icons['mdiDelete'] }}
            v-icon(v-else size="20" color="white") {{ icons['mdiDelete'] }}

      .tw-block
        v-layout(row wrap :class="listMode && recordings.length ? 'tw-m-0 tw-mt-5' : 'tw-mt-5'")
          v-flex.tw-mb-4.tw-px-2(v-if="!listMode" xs12 sm6 md4 lg3 xl2 v-for="(recording, i) in recordings" :key="recording.id")
            vue-aspect-ratio(ar="4:3")
              RecordingCard(ref="recordings" :selectedItems="selected" :recording="recording" @select="clickRow(recording)" @show="openGallery(recording)" @remove="remove(recording, i)")

          v-data-table.tw-w-full(v-if="listMode && recordings.length" :items-per-page="-1" calculate-widths disable-pagination hide-default-footer v-model="selected" :loading="loading" :headers="headers" :items="recordings" :no-data-text="$t('no_data_available')" item-key="id" show-select class="elevation-1" checkbox-color="var(--cui-primary)" mobile-breakpoint="0" @click:row="clickRow")
            template(v-slot:item.preview="{ item }")
              vue-aspect-ratio.tw-m-3(ar="16:9" width="100px")
                RecordingCard(ref="recordings" list :selectedItems="selected" :recording="item" @show="openGallery(item)" @remove="remove(item, item.index)")
            template(v-slot:item.camera="{ item }")
              b {{ item.camera }}
            template(v-slot:item.recordType="{ item }")
              .text-font-disabled {{ item.recordType }}
            template(v-slot:item.time="{ item }")
              .text-font-disabled {{ item.time }}
            template(v-slot:item.label="{ item }")
              v-chip(color="var(--cui-primary)" dark small) {{ item.label.includes("no label") ? $t("no_label") : item.label.includes("Custom") ? $t("custom") : item.label }}
            template(v-slot:item.download="{ item }")
              v-btn.tw-text-white(fab x-small color="#434343" elevation="1" @click="download(item)")
                v-icon {{ icons['mdiDownload'] }}

        infinite-loading(:identifier="infiniteId" @infinite="infiniteHandler")
          .tw-mt-10(slot="spinner")
            v-progress-circular(indeterminate color="var(--cui-primary)")
          .tw-mt-10.tw-text-sm.text-muted(slot="no-more") {{ $t("no_more_recordings") }}
          .tw-mt-10.tw-text-sm.text-muted(slot="no-results") {{ $t("no_recordings") }}

  LightBox(
    ref="lightbox"
    :media="images"
    :showLightBox="false"
    :showThumbs="false"
    showCaption
    disableScroll
  )

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
import InfiniteLoading from 'vue-infinite-loading';
import { mdiDelete, mdiDownload, mdiFilter, mdiFormatListBulleted, mdiViewModule } from '@mdi/js';
import { saveAs } from 'file-saver';
import VueAspectRatio from 'vue-aspect-ratio';

import { getRecordings, removeRecording, removeRecordings } from '@/api/recordings.api';

import { bus } from '@/main';

import FilterCard from '@/components/filter.vue';
import RecordingCard from '@/components/recording-card.vue';
import Sidebar from '@/components/sidebar-filter.vue';

import socket from '@/mixins/socket';

export default {
  name: 'Recordings',

  components: {
    FilterCard,
    InfiniteLoading,
    LightBox,
    RecordingCard,
    Sidebar,
    'vue-aspect-ratio': VueAspectRatio,
  },

  mixins: [socket],

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  data() {
    return {
      icons: {
        mdiDelete,
        mdiDownload,
        mdiFilter,
        mdiFormatListBulleted,
        mdiViewModule,
      },
      images: [],
      infiniteId: Date.now(),
      loading: false,
      page: 1,
      query: '',
      selectedFilter: [],
      recordings: [],
      totalRecordings: 0,
      showOverlay: false,

      listMode: false,
      showListOptions: true,
      toggleView: false,
      oldSelected: false,

      selected: [],

      backupHeaders: [],
      headers: [
        {
          text: '',
          value: 'preview',
          align: 'start',
          sortable: false,
          width: '100px',
          class: 'tw-px-1',
          cellClass: 'tw-px-0',
        },
        {
          text: this.$t('camera'),
          value: 'camera',
          align: 'start',
          sortable: true,
          class: 'tw-pl-3 tw-pr-1',
          cellClass: 'tw-pl-3 tw-pr-1',
        },
        {
          text: this.$t('type'),
          value: 'recordType',
          align: 'start',
          sortable: true,
          class: 'tw-py-3',
          cellClass: 'tw-py-3',
        },
        {
          text: this.$t('time'),
          value: 'time',
          align: 'start',
          sortable: true,
          class: 'tw-px-1',
          cellClass: 'tw-px-1',
        },
        {
          text: this.$t('label'),
          value: 'label',
          align: 'start',
          sortable: true,
          class: 'tw-px-1',
          cellClass: 'tw-px-1',
        },
        {
          text: '',
          value: 'download',
          align: 'start',
          sortable: false,
          width: '80px',
          class: 'tw-py-1',
          cellClass: 'tw-py-1',
        },
      ],

      diskload: {},
    };
  },

  watch: {
    query: {
      handler() {
        this.selectedFilter = this.query.split('&').filter((query) => query);
      },
    },
  },

  created() {
    bus.$on('showFilterOverlay', this.triggerFilterOverlay);
  },

  beforeDestroy() {
    bus.$off('showFilterOverlay', this.triggerFilterOverlay);

    ['resize', 'orientationchange'].forEach((event) => {
      window.removeEventListener(event, this.onResize);
    });
  },

  async mounted() {
    this.backupHeaders = [...this.headers];
    this.listMode = this.oldSelected = localStorage.getItem('listModeRecordings') === '1';

    this.loading = false;

    ['resize', 'orientationchange'].forEach((event) => {
      window.addEventListener(event, this.onResize);
    });

    this.onResize();
  },

  methods: {
    clickRow(data) {
      if (this.downloading) {
        return;
      }

      if (this.selected.find((item) => item.id === data.id)) {
        this.selected = this.selected.filter((item) => item.id !== data.id);
      } else {
        this.selected.push(data);
      }
    },
    changeListView(view) {
      localStorage.setItem('listModeRecordings', view);
      this.listMode = this.oldSelected = view === 1;
    },
    download({ url, fileName }) {
      this.downloading = true;

      const isSafari = navigator.appVersion.indexOf('Safari/') !== -1 && navigator.appVersion.indexOf('Chrome') === -1;

      const downloadFinished = () => {
        setTimeout(() => (this.downloading = false), 1000);
      };

      if (isSafari) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'blob';

        xhr.onload = function () {
          saveAs(xhr.response, fileName);
          downloadFinished();
        };

        xhr.onerror = function () {
          console.error('download failed', url);
          this.$toast.error(`${this.$t('download_failed')}`);
          downloadFinished();
        };

        xhr.send();
        return;
      }

      // Create download link.
      const link = document.createElement('a');

      if (fileName) {
        link.download = fileName;
      }

      link.href = url;
      link.style.display = 'none';

      document.body.appendChild(link);

      // Start download.
      link.click();

      // Remove download link.
      document.body.removeChild(link);

      downloadFinished();
    },
    filter(filterQuery) {
      if (this.query !== filterQuery) {
        this.loading = true;
        this.recordings = [];
        this.page = 1;
        this.query = filterQuery;
        this.infiniteId = Date.now();
        this.loading = false;
      }
    },
    async infiniteHandler($state) {
      try {
        const response = await getRecordings(`?refresh=true&pageSize=6&page=${this.page || 1}` + this.query);

        this.totalRecordings = response.data.pagination.totalItems;

        if (response.data.result.length > 0) {
          this.page += 1;
          this.recordings.push(...response.data.result);

          this.images = this.recordings.map((rec) => {
            let mediaContainer = {
              type: 'image',
              caption: `${rec.camera} - ${rec.time}`,
              src: `/files/${rec.fileName}`,
              thumb: `/files/${rec.fileName}`,
            };

            if (rec.recordType === 'Video') {
              delete mediaContainer.src;

              mediaContainer = {
                ...mediaContainer,
                type: 'video',
                sources: [
                  {
                    src: `/files/${rec.fileName}`,
                    type: 'video/mp4',
                  },
                ],
                thumb: `/files/${rec.name}@2.jpeg`,
                width: '100%',
                height: 'auto',
                autoplay: false,
              };
            }

            return mediaContainer;
          });

          $state.loaded();
        } else {
          $state.complete();
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    openGallery(item) {
      const index = this.recordings.findIndex((recording) => recording.id === item.id);
      this.$refs.lightbox.showImage(index);
    },
    onResize() {
      const removeHeaders = [];

      if (this.windowWidth() < 350) {
        removeHeaders.push('time', 'label', 'recordType', 'download');
      } else if (this.windowWidth() < 415) {
        removeHeaders.push('time', 'label', 'recordType');
      } else if (this.windowWidth() <= 550) {
        removeHeaders.push('time', 'label');
      } else if (this.windowWidth() < 605) {
        removeHeaders.push('time');

        /*if (!this.toggleView) {
          this.toggleView = true;
          this.oldSelected = this.listMode;
        }

        this.showListOptions = false;
        this.listMode = false;*/
      } else {
        /*this.showListOptions = true;

        if (this.toggleView) {
          this.listMode = this.oldSelected;
          this.toggleView = false;
        }*/
      }

      let headers = [...this.backupHeaders];

      if (removeHeaders.length) {
        headers = headers.filter((header) => !removeHeaders.some((val) => header.value === val));
      }

      this.headers = headers;
    },
    selectAllRecordings() {
      if (this.recordings.length && this.selected.length === this.recordings.length) {
        this.selected = [];
      } else {
        this.selected = this.recordings.map((recording) => recording);
      }
    },
    async remove() {
      if (!this.selected.length) {
        return;
      }

      if (this.selected.length === this.recordings.length) {
        this.removeAll();
      }

      for (const recording of this.selected) {
        try {
          await removeRecording(recording.id, '?refresh=true');

          const index = this.recordings.findIndex((rec) => rec.id === recording.id);

          this.selected = this.selected.filter((rec) => rec.id !== recording.id);
          this.recordings = this.recordings.filter((rec) => rec.id !== recording.id);

          this.images = this.images.filter((image, i) => i !== index);
          this.$toast.success(`${this.$t('recording')} ${this.$t('removed')}!`);

          this.totalRecordings--;
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);

          return;
        }
      }
    },
    async removeAll() {
      try {
        await removeRecordings();

        this.selected = [];
        this.recordings = [];
        this.images = [];
        this.$toast.success(this.$t('all_recordings_removed'));

        this.totalRecordings = 0;
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    triggerFilterOverlay(state) {
      this.showOverlay = state;
    },
    toggleFilterNavi() {
      this.showOverlay = true;
      bus.$emit('showFilterNavi', true);
    },
    windowWidth() {
      return window.innerWidth && document.documentElement.clientWidth
        ? Math.min(window.innerWidth, document.documentElement.clientWidth)
        : window.innerWidth ||
            document.documentElement.clientWidth ||
            document.getElementsByTagName('body')[0].clientWidth;
    },
  },
};
</script>

<style scoped>
.page-title {
  font-size: 1.3rem !important;
  letter-spacing: -0.025em !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
  margin-left: 5px;
}

div >>> .theme--light.v-expansion-panels .v-expansion-panel-header .v-expansion-panel-header__icon .v-icon {
  color: rgba(var(--cui-text-default-rgb)) !important;
}

.theme--light.v-btn.v-btn--disabled,
.theme--light.v-btn.v-btn--disabled .v-icon,
.theme--light.v-btn.v-btn--disabled .v-btn__loading {
  color: var(--cui-text-disabled) !important;
}

div >>> .v-btn--fab.v-btn--absolute,
div >>> .v-btn--fab.v-btn--fixed {
  z-index: 0 !important;
}

.header {
  display: flex;
}

.subtitle {
  color: rgba(var(--cui-text-third-rgb)) !important;
}

.overlay {
  background-color: #000 !important;
  border-color: #000 !important;
  opacity: 0.6;
  z-index: 1;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  /*left: -1rem;
  right: -1.5rem;
  top: -1.5rem;
  bottom: -1.5rem;*/
}

@media (min-width: 1280px) {
  .overlay {
    display: none;
  }
  .filter-nav-toggle {
    display: none !important;
  }
  .filter-content {
    margin-left: 320px;
  }
}

div >>> .v-data-table-header__icon {
  display: none;
}

@media (max-width: 600px) {
  div >>> .v-data-table__mobile-row__header {
    display: none !important;
  }

  div >>> .v-data-table__mobile-row__cell,
  div >>> .v-data-table__mobile-row__cell .vue-aspect-ratio {
    width: 100% !important;
    margin: 0 !important;
    position: relative;
    top: -30px;
    margin-bottom: -10px !important;
  }
}

.vue-aspect-ratio >>> .v-input--selection-controls__input .v-icon__svg {
  fill: #626262 !important;
}

.header-utils >>> .v-badge__badge,
.header-title >>> .v-badge__badge {
  font-size: 8px !important;
  line-height: 1.2 !important;
  border: 2px solid var(--cui-bg-default) !important;
  color: #fff !important;
}

.v-alert {
  padding: 10px !important;
}

div >>> .v-simple-checkbox .v-input--selection-controls__input {
  margin: 0 !important;
}

div
  >>> .v-data-table
  .v-input:not(.v-input--is-focused):not(.v-input--switch):not(.v-input--checkbox)
  > .v-input__control
  > .v-input__slot,
div
  >>> .v-data-table
  .v-input:not(.v-input--has-state):not(.v-input--switch):not(.v-input--checkbox)
  > .v-input__control
  > .v-input__slot {
  border: none !important;
}

div >>> .v-input--selection-controls__input svg {
  fill: var(--cui-text-hint) !important;
}
</style>
