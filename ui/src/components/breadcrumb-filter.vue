<template lang="pug">
.breadcrumb-inner.d-flex.flex-wrap.align-content-center.mt-save
  .container.d-flex.flex-wrap.align-content-center.z-index-9
    .mr-1
      b-button.all-btn.multiselect__tags(@click="resetFilter") {{ $t("all") }}
    .mr-1(v-if="showFilterCameras")
      multiselect(
        v-model="filter.cameras",
        :options="camerasFilter",
        :searchable="false",
        :close-on-select="false",
        :show-labels="false"
        :placeholder="$t('camera')",
        :multiple="true",
        :limit="0"
        :limitText="count => ''"
      )
        template(slot="noOptions")
          strong {{ $t("empty") }}
    .mr-1(v-if="showFilterRooms")
      multiselect(
        v-model="filter.rooms",
        :options="roomsFilter",
        :searchable="false",
        :close-on-select="false",
        :show-labels="false"
        :placeholder="$t('room')",
        :multiple="true",
        :limit="0"
        :limitText="count => ''"
      )
        template(slot="noOptions")
          strong {{ $t("empty") }}
    .mr-1(v-if="showFilterLabelsFor === 'recordings' || showFilterLabelsFor === 'notifications'")
      multiselect(
        v-model="filter.labels",
        :options="labelsFilter",
        :searchable="false",
        :close-on-select="false",
        :show-labels="false"
        :placeholder="$t('label')",
        :multiple="true",
        :limit="0"
        :limitText="count => ''",
      )
        template(slot="noOptions")
          strong {{ $t("empty") }}
    .mr-1(v-if="showFilterTypes")
      multiselect(
        v-model="filter.types",
        :options="typesFilter",
        :searchable="false",
        :close-on-select="false",
        :show-labels="false"
        :placeholder="$t('type')",
        :multiple="true",
        :limit="0"
        :limitText="count => ''",
        track-by="value",
        label="name",
      )
        template(slot="noOptions")
          strong {{ $t("empty") }}
    .mr-1(v-if="showFilterStatus")
      multiselect(
        v-model="filter.status",
        :options="statusFilter",
        :searchable="false",
        :close-on-select="false",
        :show-labels="false"
        :placeholder="$t('status')",
        :multiple="true",
        :limit="0"
        :limitText="count => ''",
        track-by="value",
        label="name",
      )
        template(slot="noOptions")
          strong {{ $t("empty") }}
    .col.w-100.m-0.p-0.d-flex.flex-wrap.justify-content-end.align-content-center(v-if="showFilterDate")
      DatePicker(
        v-model="filter.dateRange" 
        :model-config="modelConfig"
        mode="date"
        color="pink"
        is24hr
        is-range
        :is-dark="darkmode",
        :locale="uiConfig.language !== 'auto' ? uiConfig.language : uiConfig.currentLanguage"
      )
        template(v-slot="{ inputValue, inputEvents, togglePopover }")
          .d-flex.flex-wrap.align-content.center.justify-content-center
            span.date-range.mr-3 {{ (filter.dateRange.start || '' ) + (filter.dateRange.start && filter.dateRange.end ? ' - ' : '') + (filter.dateRange.end || '') }}
            b-icon.calendar-icon(icon="calendar-range-fill", @click="togglePopover()")
  .container.position-relative

    b-link.removeAll-wrap(v-b-modal.modal-removeAll, v-if="showAllRemove")
      .removeAll-text {{ $t("remove_all") }}
    b-modal#modal-removeAll(
      centered
      ref="removeall-modal"
      :title="$t('remove_all_confirm')",
      :cancel-title="$t('cancel')",
      :ok-title="$t('remove_all')",
      ok-variant="danger",
      @ok="$emit('remove-all')"
    )
      p.my-4 {{ $t('remove_all_confirm_text').replace('@', $t(dataType)) }}
    .filter-icon-wrap(v-if="active")
      b-icon.filter-icon(icon="filter", aria-hidden="true", @click="openFilter()")
</template>

<script>
import { BIcon, BIconFilter, BIconCalendarRangeFill } from 'bootstrap-vue';
import DatePicker from 'v-calendar/lib/components/date-picker.umd';
import Multiselect from 'vue-multiselect';
import 'vue-multiselect/dist/vue-multiselect.min.css';

import { getSetting } from '@/api/settings.api';
import { getNotifications } from '@/api/notifications.api';
import { getRecordings } from '@/api/recordings.api';

export default {
  name: 'BreadcrumbFilter',
  components: {
    BIcon,
    BIconFilter,
    BIconCalendarRangeFill,
    DatePicker,
    Multiselect,
  },
  props: {
    active: Boolean,
    dataType: {
      type: String,
      default: 'Default',
    },
    showAllRemove: Boolean,
    showFilterCameras: Boolean,
    showFilterDate: Boolean,
    showFilterLabelsFor: {
      type: String,
      default: 'none',
    },
    showFilterRooms: Boolean,
    showFilterStatus: Boolean,
    showFilterTypes: Boolean,
  },
  data() {
    return {
      darkmode: null,
      filter: {
        cameras: [],
        dateRange: {
          start: null,
          end: null,
        },
        labels: [],
        rooms: [],
        types: [],
        status: [],
      },
      modelConfig: {
        type: 'string',
        mask: 'YYYY-MM-DD',
      },
      camerasFilter: [],
      labelsFilter: [],
      roomsFilter: [],
      statusFilter: [
        {
          name: this.$t('online'),
          value: 'Online',
        },
        {
          name: this.$t('offline'),
          value: 'Offline',
        },
      ],
      typesFilter: [
        {
          name: this.$t('snapshot'),
          value: 'Snapshot',
        },
        {
          name: this.$t('video'),
          value: 'Video',
        },
      ],
    };
  },
  computed: {
    uiConfig() {
      return this.$store.state.config.ui;
    },
  },
  watch: {
    filter: {
      handler(configuredFilter) {
        const filter = { ...configuredFilter };
        filter.status = configuredFilter.status.map((status) => status.value);
        filter.types = configuredFilter.types.map((type) => type.value);
        this.$emit('filter', filter);
      },
      deep: true,
    },
  },
  async created() {
    try {
      this.darkmode = localStorage.getItem('theme') === 'dark';

      if ((this.showFilterCameras || this.showFilterRooms) && this.checkLevel('settings:cameras:access')) {
        const response = await getSetting('cameras');

        this.camerasFilter = response.data.map((camera) => camera.name).filter((name) => name);
        this.roomsFilter = [...new Set(response.data.map((camera) => camera.room).filter((room) => room))];
      }

      if (this.showFilterLabelsFor === 'recordings' && this.checkLevel('recording:access')) {
        const response = await getRecordings();

        this.labelsFilter = [
          ...new Set(response.data.result.map((recording) => recording.label).filter((label) => label)),
        ];
      }

      if (this.showFilterLabelsFor === 'notifications' && this.checkLevel('notifications:access')) {
        const response = await getNotifications();

        this.labelsFilter = [
          ...new Set(response.data.result.map((recording) => recording.label).filter((label) => label)),
        ];
      }
    } catch (err) {
      this.$toast.error(err.message);
    }
  },
  mounted() {
    document.addEventListener('scroll', this.minifyScrollHandler);
  },
  beforeDestroy() {
    document.removeEventListener('scroll', this.minifyScrollHandler);
  },
  methods: {
    minifyScrollHandler() {
      const breadcrumb = document.querySelector('.breadcrumb-inner');
      if (window.scrollY > 10) {
        breadcrumb.classList.add('breadcrumb-minify');
      } else {
        breadcrumb.classList.remove('breadcrumb-minify');
        breadcrumb.classList.remove('breadcrumb-expand');
      }
    },
    openFilter() {
      const breadcrumb = document.querySelector('.breadcrumb-inner');
      const navbar = document.querySelector('.navbar2-inner');
      const navbarBrand = document.querySelector('.navbar-brand');
      const navbarBrandIMG = document.querySelector('.navbar-brand-img');

      if (!navbar.classList.contains('navbar2-inner-minify')) {
        breadcrumb.classList.add('breadcrumb-expand');
        navbar.classList.add('navbar2-inner-minify');
        navbarBrand.classList.add('navbar-brand-minify');
        navbarBrandIMG.classList.add('navbar-brand-img-minify');
      } else {
        if (window.scrollY <= 10) {
          breadcrumb.classList.remove('breadcrumb-expand');
          breadcrumb.classList.remove('breadcrumb-minify');
          navbar.classList.remove('navbar2-inner-minify');
          navbarBrand.classList.remove('navbar-brand-minify');
          navbarBrandIMG.classList.remove('navbar-brand-img-minify');
        } else {
          if (breadcrumb.classList.contains('breadcrumb-minify')) {
            breadcrumb.classList.add('breadcrumb-expand');
            breadcrumb.classList.remove('breadcrumb-minify');
          } else if (breadcrumb.classList.contains('breadcrumb-expand')) {
            breadcrumb.classList.add('breadcrumb-minify');
            breadcrumb.classList.remove('breadcrumb-expand');
          }
        }
      }
    },
    resetFilter() {
      this.filter = {
        cameras: [],
        dateRange: {
          start: null,
          end: null,
        },
        rooms: [],
        types: [],
        status: [],
      };

      this.$emit('show-all');
    },
  },
};
</script>

<style scoped>
.breadcrumb-inner {
  background: var(--primary-color);
  font-size: 13px;
  color: #fff;
  position: fixed;
  left: 0;
  right: 0;
  top: 48px;
  padding-top: 0.4rem;
  padding-bottom: 0.4rem;
  height: 50px;
  -webkit-box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  -moz-box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  transition: 0.3s all;
  transform: translate3d(0, 0, 0);
  -webkit-transform: translate3d(0, 0, 0);
  z-index: 10;
}

.breadcrumb-expand {
  top: 63px;
}

.breadcrumb-minify {
  top: 18px;
}

.breadcrumb-button {
  font-size: 12px !important;
  padding: 5px 10px;
  background: rgb(0 0 0 / 25%);
  border: none !important;
  transition: 0.3s all;
}

.breadcrumb-button:hover {
  background: rgb(0 0 0 / 15%);
}

.removeAll-wrap {
  height: 35px;
  padding-left: 10px;
  padding-right: 10px;
  background: var(--primary-color);
  position: absolute;
  border-bottom-right-radius: 10px;
  border-bottom-left-radius: 10px;
  left: 15px;
  font-size: 12px;
  border-bottom: 3px solid var(--secondary-color);
  color: #ffffff;
  -webkit-box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  -moz-box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.removeAll-text {
  margin-top: 8px;
  cursor: pointer;
}

.filter-icon-wrap {
  width: 40px;
  height: 35px;
  background: var(--primary-color);
  position: absolute;
  border-bottom-right-radius: 10px;
  border-bottom-left-radius: 10px;
  right: 15px;
  font-size: 12px;
  border-bottom: 3px solid var(--secondary-color);
  color: #ffffff;
  -webkit-box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  -moz-box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  box-shadow: 0px 5px 5px -1px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.filter-icon {
  margin-top: 10px;
  font-size: 16px;
  cursor: pointer;
}

.filter-text {
  font-size: 14px;
  margin-right: 20px;
  color: #ffffff;
  display: none;
}

.calendar-icon {
  cursor: pointer;
  background: rgb(0 0 0 / 26%);
  padding: 8px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
}

div >>> .multiselect {
  font-size: 12px !important;
  min-height: 30px !important;
  min-width: 45px !important;
  cursor: pointer;
}

div >>> .multiselect__element {
  font-size: 10px;
}

div >>> .multiselect__content {
  width: inherit !important;
}

div >>> .multiselect__select {
  height: 27px !important;
  width: 30px !important;
  display: none;
}

div >>> .multiselect__option--selected {
  font-weight: normal !important;
}

div >>> .multiselect__tags {
  font-size: 12px !important;
  min-height: 33px !important;
  padding: 3px 5px !important;
  color: var(--primary-font-color) !important;
  text-align: center;
  line-height: 2;
}

div >>> .multiselect__option {
  /*white-space: unset !important;
  word-break: break-all !important;
  padding: 10px 5px 10px 5px !important;*/
  font-size: 10px !important;
}

div >>> .multiselect__placeholder {
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
}

div >>> .multiselect__strong {
  display: none !important;
}

div >>> .multiselect__single {
  color: var(--primary-font-color) !important;
  font-size: inherit !important;
  margin: 0 !important;
  padding: 0 !important;
  line-height: unset !important;
  min-height: unset !important;
}

div >>> .vc-container {
  --pink-100: var(--fourth-color);
  --pink-200: var(--fourth-color);
  --pink-300: var(--primary-color);
  --pink-400: var(--primary-color);
  --pink-500: var(--secondary-color);
  --pink-600: var(--secondary-color);
  --pink-700: var(--secondary-color);
  --pink-800: var(--third-color);
  --pink-900: var(--third-color);
  --gray-100: #ffffff;
  --gray-200: #f0f0f0;
  --gray-300: #e4e4e4;
  --gray-400: #dfdfdf;
  --gray-500: #c0c0c0;
  --gray-600: #949494;
  --gray-700: #666666;
  --gray-800: #3f3f3f;
  --gray-900: #1f1f1f;
}

div >>> .vc-container.vc-pink {
  --accent-100: var(--primary-color);
  --accent-200: var(--primary-color);
  --accent-300: var(--primary-color);
  --accent-400: var(--secondary-color);
  --accent-500: var(--secondary-color);
  --accent-600: var(--secondary-color);
  --accent-700: var(--third-color);
  --accent-800: var(--third-color);
  --accent-900: var(--third-color);
}

div >>> .all-btn {
  box-shadow: none !important;
  padding: 5px 8px !important;
  height: 33px;
  border-radius: 5px !important;
}

.date-range {
  display: none;
}

div >>> .vc-container.vc-is-dark {
  border-color: var(--third-bg-color) !important;
}

/*@media (max-width: 333px) {
  div >>> .multiselect {
    font-size: 10px !important;
  }

  div >>> .multiselect__tags {
    font-size: 10px !important;
  }
}*/

@media (min-width: 480px) {
  .filter-text {
    display: inline-flex;
  }
}

@media (min-width: 768px) {
  .date-range {
    display: block;
  }
}
</style>
