<template lang="pug">
v-menu(z-index="10" :content-class="datePicker && datePickerOpened ? 'datePickerOpened' : 'datePickerClosed'" v-model="showFilter" transition="slide-y-transition" min-width="260px" :close-on-content-click="false" offset-y bottom left nudge-top="-15" content-class="light-shadow")
  template(v-slot:activator="{ on, attrs }")
    v-badge(:value="selected.length" :content="selected.length" color="var(--cui-primary)" offset-x="20" offset-y="20" overlap)
      v-btn.text-font-default.tw-mr-1(icon height="38px" width="38px" v-bind="attrs" v-on="on")
        v-icon mdi-filter

  v-card.light-shadow.card-border(:class="datePicker && datePickerOpened ? 'datePickerOpened' : 'datePickerClosed'")
    .tw-p-6.tw-pb-0.tw-flex.tw-justify-between
      .tw-flex.tw-items-center.filter-menu-title {{ $t('filters') }}

      .t-block.tw-ml-auto
        v-btn.text-muted(icon height="38px" width="38px" @click="clearFilter")
          v-icon mdi-autorenew

      DatePicker(v-model="dateRange" :model-config="dateConfig" mode="date" color="pink" is24hr is-range :is-dark="darkMode" v-if="datePicker" :attributes="dateAttr" @popoverWillShow="datePickerOpened = true" @popoverDidHide="datePickerOpened = false")
        template(v-slot="{ inputValue, inputEvents, togglePopover }")
          v-btn(icon height="38px" width="38px" @click="togglePopover()" :color="dateRange.start || dateRange.end ? 'var(--cui-primary)' : 'var(--cui-text-hint)'")
            v-icon mdi-calendar

    v-list(:dark="darkMode")
      v-list-group(v-for="item in items" :key="item.id" v-model="filter[item.type]" v-if="item.enabled" no-action)
        template(v-slot:prependIcon)
          v-icon.text-font-default.tw-ml-5 {{ filter[item.type] ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
        template(v-slot:activator)
          v-list-item-content
            v-list-item-title.filter-menu-subtitle {{ item.title }}
        template(v-slot:appendIcon)
          v-icon.text-font-default 
          v-chip.tw-mr-5.tw-text-white(small color="rgba(0,0,0, 0.2)" style="font-size: 0.6rem !important;") {{ item.items.filter(child => child.selected).length }}

        v-list-item.tw-p-0(dense v-for="child in item.items" :key="child.title")
          v-checkbox(v-model="child.selected" :label="child.title" color="var(--cui-primary)" :value="child.title" hide-details)

</template>

<script>
import DatePicker from 'v-calendar/lib/components/date-picker.umd';

import { getSetting } from '@/api/settings.api';
import { getNotifications } from '@/api/notifications.api';
import { getRecordings } from '@/api/recordings.api';

export default {
  name: 'Filters',

  components: {
    DatePicker,
  },

  props: {
    camerasSelect: Boolean,
    datePicker: Boolean,
    labelSelect: Boolean,
    roomSelect: Boolean,
    statusSelect: Boolean,
    typeSelect: Boolean,
  },

  data() {
    return {
      datePickerOpened: false,

      dateRange: {
        start: null,
        end: null,
      },
      dateAttr: [
        {
          popover: {
            placement: 'right-end',
          },
        },
      ],
      dateConfig: {
        type: 'string',
        mask: 'YYYY-MM-DD',
      },

      filter: {
        cameras: false,
        labels: false,
        rooms: false,
        types: false,
      },

      items: [
        {
          enabled: this.camerasSelect,
          action: 'mdi-camera',
          type: 'cameras',
          items: [],
          title: this.$t('cameras'),
        },
        {
          enabled: this.roomSelect,
          action: 'mdi-door-open',
          type: 'rooms',
          items: [],
          title: this.$t('rooms'),
        },
        {
          enabled: this.labelSelect,
          action: 'mdi-label',
          type: 'labels',
          items: [],
          title: this.$t('labels'),
        },
        {
          enabled: this.typeSelect,
          action: 'mdi-image-multiple',
          type: 'types',
          items: [
            { title: this.$t('snapshot'), selected: false },
            { title: this.$t('video'), selected: false },
          ],
          title: this.$t('type'),
        },
      ],

      page: 1,

      query: '',

      selected: [],

      showFilter: false,
    };
  },

  computed: {
    darkMode() {
      return localStorage.getItem('theme') === 'dark';
    },
  },

  async created() {
    try {
      if (this.$route.name === 'Notifications') {
        this.items.forEach((item) => {
          if (item.type === 'types') {
            item.items.push(
              {
                title: this.$t('error'),
                selected: false,
              },
              {
                title: this.$t('warning'),
                selected: false,
              }
            );
          }
        });
      }

      if (this.camerasSelect) {
        const response = await getSetting('cameras');

        this.items.forEach((item) => {
          if (item.type === 'cameras') {
            item.items = response.data.map((camera) => {
              return {
                title: camera.name,
                selected: false,
              };
            });
          }
        });
      }

      if (this.labelSelect) {
        if (this.$route.name === 'Notifications') {
          const labels = await this.getNotificationLabels();

          this.items.forEach((item) => {
            if (item.type === 'labels') {
              const items = [
                ...new Set(
                  labels.map((label) =>
                    label.includes('no label')
                      ? this.$t('no_label')
                      : label.includes('Custom')
                      ? this.$t('custom')
                      : label
                  )
                ),
              ];

              item.items = items.map((item) => {
                return {
                  title: item,
                  selected: false,
                };
              });
            }
          });
        } else if (this.$route.name === 'Recordings') {
          const labels = await this.getRecordingsLabels();

          this.items.forEach((item) => {
            if (item.type === 'labels') {
              const items = [
                ...new Set(
                  labels.map((label) =>
                    label.includes('no label')
                      ? this.$t('no_label')
                      : label.includes('Custom')
                      ? this.$t('custom')
                      : label
                  )
                ),
              ];

              item.items = items.map((item) => {
                return {
                  title: item,
                  selected: false,
                };
              });
            }
          });
        }
      }

      if (this.roomSelect) {
        const response = await getSetting('general');

        this.items.forEach((item) => {
          if (item.type === 'rooms') {
            item.items = response.data.rooms.map((room) => {
              return {
                title: room === 'Standard' ? this.$t('standard') : room,
                selected: false,
              };
            });
          }
        });
      }
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }

    this.$watch('showFilter', this.watchShowFilter, { deep: true });
    this.$watch('items', this.watchItems, { deep: true });
    this.$watch('dateRange', this.watchDateRange, { deep: true });
  },

  methods: {
    clearFilter() {
      this.items.forEach((item) => {
        item.items.forEach((child) => {
          child.selected = false;
        });
      });

      this.dateRange = {
        start: null,
        end: null,
      };
    },
    filterQuery(filter) {
      if (filter && filter.length) {
        this.query = '';

        let cameras = filter
          .map((item) => {
            if (item.type === 'cameras') {
              return item.value;
            }
          })
          .filter((item) => item);

        let labels = filter
          .map((item) => {
            if (item.type === 'labels') {
              return item.value;
            }
          })
          .filter((item) => item);

        let rooms = filter
          .map((item) => {
            if (item.type === 'rooms') {
              return item.value;
            }
          })
          .filter((item) => item);

        let types = filter
          .map((item) => {
            if (item.type === 'types') {
              return item.value;
            }
          })
          .filter((item) => item);

        let date = filter
          .map((item) => {
            if (item.type === 'date') {
              return item.value;
            }
          })
          .filter((item) => item);

        if (cameras && cameras.length > 0) {
          this.query += `&cameras=${cameras.toString()}`;
        }

        if (labels && labels.length > 0) {
          const customLabel = this.$t('custom');
          const noLabel = this.$t('no_label');

          labels = labels.map((label) => {
            if (label === customLabel) {
              return 'Custom';
            } else if (label === noLabel) {
              return 'no label';
            } else {
              return label;
            }
          });

          this.query += `&labels=${labels.toString()}`;
        }

        if (rooms && rooms.length > 0) {
          const standard = this.$t('standard');

          rooms = rooms.map((room) => {
            if (room === standard) {
              return 'Standard';
            } else {
              return room;
            }
          });

          this.query += `&rooms=${rooms.toString()}`;
        }

        if (types && types.length > 0) {
          const snapshot = this.$t('snapshot');
          const video = this.$t('video');
          const errorType = this.$t('error');
          const warnType = this.$t('warning');

          types = types.map((type) => {
            if (type === snapshot) {
              return 'Snapshot';
            } else if (type === video) {
              return 'Video';
            } else if (type === errorType) {
              return 'ERROR';
            } else if (type === warnType) {
              return 'WARN';
            } else {
              return type;
            }
          });

          this.query += `&types=${types.toString()}`;
        }

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
    async getNotificationLabels() {
      const labels = [];
      let response = await getNotifications('?page=1');

      for (this.page; this.page <= response.data.pagination.totalPages; this.page++) {
        if (this.page > 1) {
          response = await getNotifications(`?page=${this.page}`);
        }
        response.data.result.forEach((notification) => labels.push(notification.label));
      }

      return labels;
    },
    async getRecordingsLabels() {
      const labels = [];
      let response = await getRecordings('?page=1');

      for (this.page; this.page <= response.data.pagination.totalPages; this.page++) {
        if (this.page > 1) {
          response = await getRecordings(`?page=${this.page}`);
        }
        response.data.result.forEach((recording) => labels.push(recording.label));
      }

      return labels;
    },
    watchDateRange() {
      const selected = [];
      const date = {};

      if (this.dateRange.start) {
        date.start = this.dateRange.start;

        if (this.dateRange.end) {
          date.end = this.dateRange.end;
        }

        selected.push({
          value: date,
          type: 'date',
        });
      }

      this.selected = this.selected.filter((item) => item.type !== 'date');
      this.selected.push(...selected);

      this.filterQuery(this.selected);
    },
    watchItems() {
      const selected = [];

      this.items.forEach((item) => {
        item.items.forEach((child) => {
          if (child.selected) {
            selected.push({
              value: child.title,
              type: item.type,
            });
          }
        });
      });

      this.selected = this.selected.filter((item) => item.type === 'date');
      this.selected.push(...selected);

      this.filterQuery(this.selected);
    },
    watchShowFilter() {
      if (!this.showFilter) {
        this.datePickerOpened = this.showFilter;
      }
    },
  },
};
</script>

<style scoped>
span >>> .v-badge__badge {
  height: 16px;
  font-size: 8px;
  min-width: 16px;
}

.filter-menu-title {
  font-weight: 700;
  font-size: 1.2rem;
}

.filter-menu-subtitle {
  font-weight: 700 !important;
  font-size: 0.9rem !important;
}

.datePickerClosed {
  min-height: 0px;
  transition: 0.2s all;
}

.datePickerOpened {
  min-height: 360px;
  transition: 0.2s all;
}

div >>> .v-list {
  min-width: 320px;
  padding-bottom: 0;
}

div >>> .v-list-item {
  padding: 0 !important;
}

div >>> .v-list-item__icon {
  margin-right: 5px !important;
}

div >>> .v-list-group {
  padding: 0;
  margin-bottom: 0;
}

div >>> .v-list-group__header {
  border-bottom: 1px solid rgba(var(--cui-text-default-rgb), 0.1);
}

div >>> .v-list-group__items {
  background: rgba(var(--cui-menu-secondary-rgb)) !important;
  border-bottom: 1px solid rgba(var(--cui-text-secondary-rgb), 0.1);
  padding: 1rem;
}

div >>> .v-input--selection-controls {
  margin-top: 0;
  padding-top: 0;
}

div >>> .v-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--cui-text-default);
}

div >>> .v-list-group__items {
  padding: 0;
  padding-top: 10px !important;
  padding-bottom: 10px !important;
}

div >>> .v-input input,
div >>> .v-icon {
  color: rgba(var(--cui-text-default-rgb), 0.6);
}

div >>> .v-input--selection-controls__input {
  margin-left: 1.3rem;
}

@media (max-width: 330px) {
  div >>> .v-list {
    min-width: 260px;
  }
}

div >>> .vc-container {
  --pink-100: var(--cui-primary-400);
  --pink-200: var(--cui-primary-400);
  --pink-300: var(--cui-primary);
  --pink-400: var(--cui-primary);
  --pink-500: var(--cui-primary-600);
  --pink-600: var(--cui-primary-600);
  --pink-700: var(--cui-primary-600);
  --pink-800: var(--cui-primary-900);
  --pink-900: var(--cui-primary-900);
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
  --accent-100: var(--cui-primary);
  --accent-200: var(--cui-primary);
  --accent-300: var(--cui-primary);
  --accent-400: var(--cui-primary-600);
  --accent-500: var(--cui-primary-600);
  --accent-600: var(--cui-primary-600);
  --accent-700: var(--cui-primary-900);
  --accent-800: var(--cui-primary-900);
  --accent-900: var(--cui-primary-900);
}

.date-range {
  display: none;
}

div >>> .vc-container.vc-is-dark {
  border-color: rgba(var(--cui-text-default-rgb), 0.2) !important;
}
</style>
