<template lang="pug">
.settings-navi.pl-safe.pb-safe.tw-flex.tw-flex-col.tw-h-full(key="filterSidebar" :class="(showSidebar ? 'filter-navi-show ' : '') + (extendSidebar ? 'extended-sidebar' : '')" v-click-outside="{ handler: hideNavi, include: include }")
  .tw-p-5
    .tw-block.tw-mb-5
      h4.tw-mb-4 {{ $t('timerange') }}
      v-icon.text-muted(@click="hideNavi") {{ icons['mdiCalendarRange'] }}

      v-menu(v-model="dateModalFrom" content-class="datePicker" close-on-content-click transition="scroll-y-transition" offset-y bottom max-width="280px" min-width="auto")
        template(v-slot:activator="{ on, attrs }")
          v-text-field(dense clearable v-model="dateFrom" label="..." readonly hide-details prepend-inner-icon="mdiCalendarRange" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" v-bind="attrs" v-on="on" solo @click:clear="saveDateRange('from', true)")
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiCalendarRange'] }}
          label.form-input-label {{ $t('from') }}
        v-date-picker(v-model="dateFrom" scrollable no-title @input="saveDateRange('from')" :locale="uiConfig.currentLanguage")

      .tw-my-4

      v-menu(v-model="dateModalTo" content-class="datePicker" close-on-content-click transition="scroll-y-transition" offset-y bottom max-width="280px" min-width="auto")
        template(v-slot:activator="{ on, attrs }")
          v-text-field(dense clearable v-model="dateTo" label="..." readonly hide-details prepend-inner-icon="mdiCalendarRange" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" v-bind="attrs" v-on="on" solo @click:clear="saveDateRange('to', true)")
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiCalendarRange'] }}
          label.form-input-label {{ $t('to') }}
        v-date-picker(v-model="dateTo" scrollable no-title @input="saveDateRange('to')" :locale="uiConfig.currentLanguage")

      v-divider.tw-mb-3.tw-mt-6

      <download-excel :data="temperaturesJson">
        v-btn.tw-text-white.tw-py-6(@click="" color="var(--cui-primary)" block elevation="1") Download Data
      </download-excel>

        v-btn.tw-text-white.tw-py-6(@click="printGraph" color="var(--cui-primary)" block elevation="1") Download Graph

        //https://stackoverflow.com/questions/49390314/how-to-use-html2canvas-with-vue-js
        v-btn.tw-text-white.tw-py-6(@click="clearFilter" color="var(--cui-primary)" block elevation="1") Reset

</template>

<script>
import { mdiCalendarRange, mdiCamera, mdiDoorOpen, mdiLabel, mdiImageMultiple } from '@mdi/js';

import { bus } from '@/main';
export default {
  name: 'SidebarTempGraphFilter',

  props: {
    camerasSelect: Boolean,
    datePicker: Boolean,
    labelSelect: Boolean,
    roomSelect: Boolean,
    statusSelect: Boolean,
    typeSelect: Boolean,
    presetSelect: Boolean,
    regionsSelect: Boolean,
    intervalSelect: Boolean,
    temperaturesJson: {
      type: Array,
      default: () => [],
    },
    camera: {
      type: Object,
      default: () => ({}),
    },
  },

  data() {
    return {
      icons: {
        mdiCalendarRange,
        mdiCamera,
        mdiDoorOpen,
        mdiLabel,
        mdiImageMultiple,
      },
      extendSidebar: false,
      extendSidebarTimeout: null,
      showSidebar: false,

      dateModalFrom: false,
      dateModalTo: false,
      dateFrom: '',
      dateTo: '',

      filter: {
        cameras: false,
        labels: false,
        rooms: false,
        types: false,
      },

      page: 1,
      query: '',
      showFilter: false,

      selected: [],

      availableCameras: [],
      selectedCameras: [],

      availableRooms: [],
      selectedRooms: [],

      availableLabels: [],
      selectedLabels: [],

      availableTypes: [this.$t('snapshot'), this.$t('video')],
      selectedTypes: [],
    };
  },

  computed: {
    darkMode() {
      return localStorage.getItem('theme') === 'dark';
    },
    uiConfig() {
      return this.$store.state.config.ui;
    },
  },

  watch: {
    '$route.path': {
      handler() {
        if (this.showSidebar) {
          this.hideNavi();
        }
      },
    },
  },

  async created() {
    bus.$on('showFilterNavi', this.toggleSettingsNavi);
    bus.$on('extendSidebar', this.triggerSidebar);
  },

  mounted() {
    this.getCurrentDate();
  },

  beforeDestroy() {
    bus.$off('showFilterNavi', this.toggleSettingsNavi);
    bus.$off('extendSidebar', this.triggerSidebar);
  },

  methods: {
    include() {
      return [
        ...document.querySelectorAll('.filter-included'),
        ...document.querySelectorAll('.datePicker'),
        ...document.querySelectorAll('.v-list'),
      ];
    },
    hideNavi() {
      this.showSidebar = false;
      bus.$emit('showFilterOverlay', false);
    },
    toggleSettingsNavi(state) {
      state = this.showSidebar ? !state : state;
      this.showSidebar = state;
    },
    triggerSidebar(state) {
      this.extendSidebar = state;
    },
    clearFilter() {
      this.dateFrom = '';
      this.dateTo = '';

      this.saveDateRange();
      this.watchItems();
      this.hideNavi();
    },
    async printGraph() {
      console.log('printing..');
      const el = this.$refs.chart;

      const options = {
        type: 'dataURL',
      };
      const printCanvas = await this.$html2canvas(el, options);

      const link = document.createElement('a');
      link.setAttribute('download', 'chart.png');
      link.setAttribute('href', printCanvas.toDataURL('image/png').replace('image/png', 'image/octet-stream'));
      link.click();

      console.log('done');
    },
    filterQuery() {
      if (this.selected && this.selected.length) {
        this.query = '';

        let date = this.selected
          .map((item) => {
            if (item.type === 'date') {
              return item.value;
            }
          })
          .filter((item) => item);

        if (date && date.length > 0 && date[0].start) {
          this.query += `&from=${date[0].start}`;
        }

        if (date && date.length > 0 && date[0].end) {
          this.query += `&to=${date[0].end}`;
        }
      } else {
        this.query = '';
      }

      this.$emit('filter', this.query);
    },
    saveDateRange(target, clear) {
      if (target === 'from') {
        this.dateModalFrom = false;

        if (clear) {
          this.dateFrom = '';
        }
      } else if (target === 'to') {
        this.dateModalTo = false;

        if (clear) {
          this.dateTo = '';
        }
      }

      const selected = [];

      if (this.dateFrom) {
        selected.push({
          value: {
            start: this.dateFrom,
            end: this.dateTo,
          },
          type: 'date',
        });
      }

      this.selected = this.selected.filter((item) => item.type !== 'date');
      this.selected.push(...selected);

      this.filterQuery(this.selected);
    },
    watchItems() {
      const selected = [];

      this.selected = this.selected.filter((item) => item.type === 'date');
      this.selected.push(...selected);

      this.filterQuery(this.selected);
    },
    getCurrentDate() {
      let today = new Date();
      const offset = today.getTimezoneOffset();
      today = new Date(today.getTime() - offset * 60 * 1000);
      this.dateFrom = today.toISOString().split('T')[0];
      this.dateTo = today.toISOString().split('T')[0];
    },
  },
};
</script>

<style scoped>
.form-input-label {
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 2;
}

.datePicker {
  border: 1px solid var(--cui-bg-card);
}

.settings-navi {
  background: rgba(var(--cui-bg-app-bar-rgb));
  position: fixed;
  overflow-y: scroll;
  overflow-x: hidden;
  top: calc(64px + env(safe-area-inset-top, 0px));
  bottom: 0;
  min-width: 0px;
  max-width: calc(320px + env(safe-area-inset-left, 0px));
  height: calc(100vh - 64px - env(safe-area-inset-top, 0px));
  min-height: calc(100vh - 64px - env(safe-area-inset-top, 0px));
  max-height: calc(100vh - 64px - env(safe-area-inset-top, 0px));
  transition: 0.3s all;
  z-index: 98;
  left: -600px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  width: calc(320px + env(safe-area-inset-left, 0px));
  box-shadow: 3px 0px 3px -2px rgb(0 0 0 / 25%), 3px 0px 4px 0px rgb(0 0 0 / 11%), 1px 0px 38px 0px rgb(0 0 0 / 5%) !important;
}

.settings-navi::-webkit-scrollbar {
  width: 0px;
  display: none;
}

.filter-navi-show {
  width: calc(320px + env(safe-area-inset-left, 0px));
  min-width: calc(320px + env(safe-area-inset-left, 0px));
  left: 77px;
}

.sidebar-nav-items {
  max-height: 300px !important;
  width: 320px !important;
  border-bottom: 1px solid rgba(var(--cui-text-default-rgb), 0.05) !important;
}

.sidebar-nav-items-active {
  background: rgba(var(--cui-text-default-rgb), 0.05) !important;
}

.sidebar-nav-items-bottom {
  margin-bottom: 44px;
}

.sidebar-nav-item {
  color: rgba(255, 255, 255, 0.6);
  height: auto !important;
  white-space: unset !important;
  letter-spacing: unset !important;
  text-transform: unset !important;
  font-weight: unset !important;
  text-indent: unset !important;
  color: rgba(var(--cui-text-default-rgb)) !important;
  opacity: 1 !important;
}

.sidebar-settings-nav-item-active,
.sidebar-nav-item:hover {
  color: rgba(255, 255, 255, 1);
}

.sidebar-nav-item-text {
  font-weight: 600 !important;
  font-size: 0.875rem !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  line-height: 1.8 !important;
}

.sidebar-nav-item-text-light {
  color: rgba(var(--cui-primary-rgb)) !important;
}

.sidebar-nav-item-text-dark {
  color: rgba(var(--cui-primary-500-rgb)) !important;
}

.siderbar-nav-divider {
  border-color: rgba(255, 255, 255, 0.06) !important;
}

.page-title {
  font-size: 1.5rem !important;
  letter-spacing: -0.025em !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
  margin-left: 0.5rem !important;
}

.subnavi-toggle {
  display: block;
}

.sidebar-nav-item >>> .v-btn__content {
  align-items: flex-start !important;
}

@media (max-width: 960px) {
  .settings-navi {
    /*position: fixed;*/
    left: -1000px;
  }
  .filter-navi-show {
    left: 0 !important;
  }
}

@media (min-width: 1280px) {
  .subnavi-toggle {
    display: none;
  }
  .extended-sidebar {
    left: 280px !important;
  }
  .settings-navi {
    width: calc(320px + env(safe-area-inset-left, 0px)) !important;
    min-width: calc(320px + env(safe-area-inset-left, 0px)) !important;
    left: 77px;
    border-right: 1px solid rgba(var(--cui-bg-settings-border-rgb)) !important;
    box-shadow: none !important;
  }
}

.selector >>> .v-chip__content {
  color: #fff !important;
}
</style>
