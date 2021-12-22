<template lang="pug">
.content
  .tw-absolute.tw-right-2.tw-top-2.tw-z-10
    v-btn(icon x-small @click="dialog = true")
      v-icon {{ icons['mdiCog'] }}

  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="white" size="20")
  
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-else-if="!owmInfo")
    v-btn(fab small depressed @click="dialog = true")
      v-icon {{ icons['mdiPlusThick'] }}
  
  .tw-h-full.tw-w-full.tw-p-4.tw-relative.tw-flex.tw-flex-col.tw-items-start.tw-justify-center(v-if="!loading && owmInfo")
    .weatherTitle {{ owmInfo.weather[0].description }}
    .weatherBox.tw-flex.tw-flex-row.tw-mt-3
      .weatherDegree.tw-pl-3.tw-flex.tw-items-center.tw-justify-center {{ Math.round(owmInfo.main.temp) }}°
      .divider.tw-mx-3
      .tw-block.tw-flex.tw-flex-col.tw-justify-center
        .weatherDate {{ date }}
        .weatherLocation
          v-icon.tw-mr-1(size="12" color="rgba(255, 255, 255, 0.5)" style="margin-bottom: 2px;") {{ icons['mdiMapMarker'] }}
          span {{ owmInfo.name }}
    .sun
      v-img(:src="owmInfo.img")

  v-dialog(v-model="dialog" width="500" scrollable)
    v-card(height="400")
      v-card-title {{ $t('location') }}
      v-divider
      v-card-text.tw-p-7.tw-flex.tw-flex-col.tw-items-center.tw-justify-center
        .tw-block(v-if="loadingDialog")
          v-progress-circular(indeterminate color="var(--cui-primary)" size="20")

        .tw-w-full.tw-h-full(v-else)
          v-sheet.tw-p-3(rounded class="mx-auto" width="100%" color="rgba(0,0,0,0.2)")
            span.text-default {{ $t('weather_widget_info') }}

          .tw-w-full.tw-mt-5
            label.text-default {{ $t('location') }}
            v-text-field(v-model="userInput.location" prepend-inner-icon="mdi-crosshairs-gps" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" :rules="rules.string" required solo)
              template(v-slot:prepend-inner)
                v-icon.text-muted {{ icons['mdiMapMarker'] }}

          .tw-w-full.tw-text-center
            span.text-default.tw-mt-3 {{ $t('weather_widget_info_owm') }}

      v-divider
      v-card-actions.tw-flex.tw-justify-end
        v-btn.text-default(text @click='dialog = false') {{ $t('cancel') }}
        v-btn(color='var(--cui-primary)' text @click='applyData(true)') {{ $t('apply') }}
      
</template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiCog, mdiMapMarker, mdiPlusThick } from '@mdi/js';

import { getSetting } from '@/api/settings.api';

export default {
  name: 'WeatherWidget',

  props: {
    item: Object,
  },

  data() {
    return {
      loading: true,
      loadingDialog: false,

      dialog: null,

      date: '',

      icons: {
        mdiCog,
        mdiMapMarker,
        mdiPlusThick,
      },

      refreshTimer: null,

      rules: {
        string: [(v) => !!v || this.$t('field_must_not_be_empty')],
      },

      owmInfo: null,

      userInput: {
        location: '',
        api_key: '550d972c6e25316a8a59ad0f07c6c237',
        base_url: 'https://api.openweathermap.org/data/2.5/',
      },

      location: null,
    };
  },

  watch: {
    '$route.path': {
      handler() {
        this.dialog = false;
      },
    },
  },

  async mounted() {
    const date = new Date();

    this.date = `${this.getDay(date.getDay())}, ${date.getUTCDate()} ${this.getMonth(date.getMonth())}`;

    try {
      const widgets = await getSetting('widgets');
      const items = widgets.data.items;

      const weatherWidget = items.find((item) => item.id === this.item.id);

      if (weatherWidget?.location) {
        this.location = weatherWidget.location;
        this.userInput.location = weatherWidget.location.name;
        await this.applyData();
      }

      this.loading = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  methods: {
    async applyData(fromDialog) {
      if (this.owmInfo?.name === this.userInput.location) {
        return;
      }

      if (fromDialog) {
        this.loadingDialog = true;
      }

      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }

      try {
        const response = await fetch(
          `${this.userInput.base_url}weather?q=${this.userInput.location}&units=metric&appid=${this.userInput.api_key}&lang=${this.$i18n.locale}`
        );

        this.owmInfo = await response.json();
        this.owmInfo.img = `https://openweathermap.org/img/wn/${this.owmInfo.weather[0].icon}@4x.png`;

        if (!this.location) {
          this.saveLocation();
        }

        this.refreshTimer = setTimeout(() => {
          if (this.owmInfo) {
            this.applyData();
          }
        }, 60 * 60 * 1000);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);

        this.owmInfo = null;
      }

      if (fromDialog) {
        setTimeout(() => {
          this.loadingDialog = false;
          this.dialog = false;
        }, 1000);
      }
    },
    getDay(index) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      return this.$t(days[index]);
    },
    getMonth(index) {
      const month = [
        'january',
        'february',
        'march',
        'april',
        'may',
        'june',
        'july',
        'august',
        'september',
        'october',
        'november',
        'december',
      ];
      return this.$t(month[index]);
    },
    saveLocation() {
      const location = {
        id: this.owmInfo.id,
        name: this.owmInfo.name,
        country: this.owmInfo.sys.country,
        coord: this.owmInfo.coord,
      };

      this.$emit('widgetData', {
        id: this.item.id,
        data: {
          location: location,
        },
      });
    },
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  background: rgb(32, 148, 253);
  background: linear-gradient(90deg, rgba(32, 148, 253, 1) 0%, rgba(90, 185, 254, 1) 100%);
  border-radius: 10px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
}

.widget {
}

.divider {
  width: 1px;
  height: 100%;
  background: rgb(255, 255, 255);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0) 100%
  );
}

.weatherTitle {
  font-size: 0.75rem;
  color: #fff;
}

.weatherBox {
  height: 50px;
  z-index: 2;
}

.weatherDegree {
  font-size: 1.75rem;
  font-weight: bold;
  color: #fff;
}

.weatherDate {
  font-size: 0.75rem;
  color: #fff;
}

.weatherLocation {
  font-size: 0.9rem;
  font-weight: 500;
  color: #fff;
}

.sun {
  position: absolute;
  transform: translateY(-50%);
  top: 50%;
  height: 100px;
  width: 100px;
  /*border-radius: 50%;*/
  right: 20px;
  /*background: #efb76f;
  box-shadow: 0 0 0 5px rgba(255, 158, 45, 0.1), 0 0 0 10px rgba(255, 158, 45, 0.05), 0 0 0 15px rgba(255, 158, 45, 0.1);
  animation: ray 1s infinite;*/
  z-index: 1;
}

/*@keyframes ray {
  0% {
    box-shadow: 0 0 0 5px rgba(255, 158, 45, 0.1), 0 0 0 10px rgba(255, 158, 45, 0.05),
      0 0 0 15px rgba(255, 158, 45, 0.1);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(255, 158, 45, 0.1), 0 0 0 15px rgba(255, 158, 45, 0.05),
      0 0 0 20px rgba(255, 158, 45, 0.1);
  }
  100% {
    box-shadow: 0 0 0 5px rgba(255, 158, 45, 0.1), 0 0 0 10px rgba(255, 158, 45, 0.05),
      0 0 0 15px rgba(255, 158, 45, 0.1);
  }
}*/
</style>
