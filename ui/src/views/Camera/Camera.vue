<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .tw-max-w-7xl.pl-safe.pr-safe
    Sidebar(datePicker @intervalModifier="modifyInterval" @filter="filter" :temperaturesJson="exportData" :camera="camera")

  .filter-content.filter-included.v-col.tw-flex.tw-justify-between.tw-items-center.tw-mt-2.tw-w-full.tw-relative(cols="cols")
    .tw-w-full.tw-flex.tw-justify-between.tw-items-center
      .tw-block
        h2.tw-leading-6 {{ $route.params.name }}
      .tw-block
        v-btn.tw-text-white(fab small color="var(--cui-primary)" @click="$router.push(`/cameras/${camera.name}/feed`)")
          v-icon(size="20") {{ icons['mdiOpenInNew'] }}

  .overlay(v-if="showOverlay")

  .filter-content.filter-included.tw-w-full.tw-relative
    .tw-flex.tw-justify-between
      .header-title.tw-flex.tw-items-center
        v-btn.included.filter-cleanup.filter-nav-toggle(@click="toggleFilterNavi" icon height="38px" width="38px" :color="selectedFilter.length ? 'var(--cui-primary)' : 'var(--cui-text-default)'")
          v-icon {{ icons['mdiFilter'] }}

  .filter-content.filter-included.tw-flex.tw-flex-wrap
    v-row.tw-w-full.tw-max-h-400
      v-col.tw-mb-3(:cols="cols" ref="chartExport")
        Chart.tw-mt-5(:dataset="camTempData" :options="camTempsOptions" ref="chart")

  .filter-content.filter-included.tw-flex.tw-flex-wrap(v-if="camera.data.settings.type === 'PTZ'")
    v-row.tw-w-full.tw-max-h-400
      v-col.tw-mb-3(:cols="cols" ref="chartExport2")
        Chart.tw-mt-5(:dataset="camTempData" :options="camTempsOptions" ref="chart")


  .filter-content
    <v-row class="ma-4 justify-space-around">
      <v-btn v-for="(item, index) in cameraPresets" @click="goToPreset(item.presetId)" :key="item.presetId" color="red" outlined>{{item.presetName}}[{{ item.presetId}}]</v-btn>
    </v-row>

  .filter-content.filter-included.tw-flex.tw-flex-wrap
    v-row.tw-w-full.max-h-screen
      v-col.tw-mb-3(:cols="cols")
        vue-aspect-ratio(ar="16:9" width="100%")
          VideoCard(:ref="camera.name" :camera="camera" stream noLink hideNotifications)

  .filter-content.filter-included.v-col.tw-flex.tw-justify-between.tw-items-center.tw-mt-2.tw-w-full.tw-relative(cols="cols")
    .tw-w-full.tw-flex.tw-justify-between.tw-items-center
      .tw-block
        h2.tw-leading-6
      .tw-block
        v-btn.tw-text-white(fab small color="var(--cui-primary)" @click="$router.push(`/cameras/${camera.name}/feed`)")
          v-icon(size="20") {{ icons['mdiOpenInNew'] }}

  .filter-content.filter-included.v-col.tw-flex.tw-justify-between.tw-items-center.tw-mt-2.tw-w-full.tw-relative(:cols="cols")
    v-expansion-panels(v-model="notificationsPanel" multiple)
      v-expansion-panel.notifications-panel(v-for="(item,i) in 1" :key="i")
        v-expansion-panel-header.notifications-panel-title.text-default.tw-font-bold {{ $t('notifications') }}
        v-expansion-panel-content.notifications-panel-content
          v-virtual-scroll(v-if="notifications.length" :items="notifications" item-height="74" max-height="400" bench="10" style="border-bottom-right-radius: 10px; border-bottom-left-radius: 10px;")
            template(v-slot:default="{ item }")
              v-list.tw-p-0(two-line dense)
                v-list-item(v-for="(notification,i) in notifications" :key="notification.id" :class="i !== notifications.length - 1 ? 'notification-item' : ''")
                  v-list-item-avatar
                    v-avatar(size="40" color="black")
                      v-img(v-on:error="notification.error = true" :src="!notification.error ? `/files/${notification.recordType === 'Video' ? `${notification.name}@2.jpeg` : notification.fileName}` : require('../../assets/img/logo.png')" width="56")
                        template(v-slot:placeholder)
                          .tw-flex.tw-justify-center.tw-items-center.tw-h-full
                            v-progress-circular(indeterminate color="var(--cui-primary)" size="16")
                  v-list-item-content
                    v-list-item-title.text-default.tw-font-semibold {{ `${$t('camera_alarm')} (${notification.label.includes("no label") ? $t("no_label") : notification.label.includes("Custom") ? $t("custom") : notification.label})` }}
                    v-list-item-subtitle.text-muted {{ `${$t('time')}: ${notification.time}` }}
                    v-list-item-subtitle.text-muted {{ `Alert Info: ${notification.message}` }}
                  v-list-item-action
                    v-btn.text-muted(icon @click="openGallery(notification)")
                      v-icon {{ icons['mdiPlusCircle'] }}
          .tw-flex.tw-justify-center.tw-items-center.tw-w-full(v-if="!notifications.length" style="height: 100px")
            v-list.tw-p-0(dense)
              v-list-item
                v-list-item-content
                  v-list-item-title.text-muted.tw-font-semibold.tw-text-center {{ $t('no_notifications') }}

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
import { mdiOpenInNew, mdiPlusCircle, mdiFilter } from '@mdi/js';
import VueAspectRatio from 'vue-aspect-ratio';
import { getCamera, getCameraSettings, getCameraPresets, goToCameraPreset } from '@/api/cameras.api';
import { getNotifications } from '@/api/notifications.api';
import { getTemperatures } from '@/api/temperatures.api';
import VideoCard from '@/components/camera-card.vue';
import Chart from '@/components/camera-temperature-charts.vue';
import socket from '@/mixins/socket';
import Sidebar from '@/components/sidebar-temp-graph-filter.vue';
import { bus } from '@/main';
const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export default {
  name: 'Camera',
  components: {
    LightBox,
    VideoCard,
    Chart,
    'vue-aspect-ratio': VueAspectRatio,
    Sidebar,
  },
  mixins: [socket],
  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },
  data() {
    return {
      temperatures: null,
      camera: {},
      cols: 12,
      icons: {
        mdiOpenInNew,
        mdiPlusCircle,
        mdiFilter,
      },
      images: [],
      loading: true,
      notifications: [],
      notificationsPanel: [0],
      showNotifications: false,
      camTempData: {
        labels: [],
        datasets: [
          {
            label: '',
            data: [],
          },
        ],
      },
      camTempsOptions: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
          },
        },
        elements: {
          point: {
            radius: 0,
            hitRadius: 10,
            hoverRadius: 10,
          },
        },
        tooltips: {
          enabled: true,
          mode: 'single',
          callbacks: {
            title: (tooltipItems) => {
              let time = new Date(tooltipItems[0].xLabel);
              time.setTime(time.getTime() - new Date().getTimezoneOffset() * 60 * 1000);
              time = time.toISOString().split('T');
              return `${time[0]} - ${time[1].split('.')[0]}`;
            },
            label: (tooltipItems) => {
              return ` ${tooltipItems.yLabel.toFixed(0)}°`;
            },
          },
        },
        scales: {
          xAxes: [
            {
              display: true,
              gridLines: {
                display: true,
                color: 'rgba(92,92,92, 0.3)',
              },
              scaleLabel: {
                display: false,
                //labelString: 'Month',
              },
              type: 'time',
              time: {
                unit: 'minute',
                displayFormats: {
                  millisecond: 'MMM DD HH:mm',
                  second: 'MMM DD HH:mm',
                  minute: 'MMM DD HH:mm',
                  hour: 'MMM DD HH:mm',
                  day: 'MMM DD HH:mm',
                  week: 'MMM DD HH:mm',
                  month: 'MMM DD HH:mm',
                  quarter: 'MMM DD HH:mm',
                  year: 'MMM DD HH:mm',
                },
                unitStepSize: 30,
              },
            },
          ],
          yAxes: [
            {
              display: true,
              gridLines: {
                display: true,
                color: 'rgba(92,92,92, 0.3)',
              },
              scaleLabel: {
                display: false,
                //labelString: 'Value',
              },
              ticks: {
                min: 20,
                max: 55,
                stepSize: 1,
                callback: function (value) {
                  return value + '°';
                },
              },
              type: 'linear',
            },
          ],
        },
      },
      polling: null,
      showOverlay: true,
      query: '',
      selectedFilter: [],
      exportData: [],
      cameraPresets: [],
    };
  },
  watch: {
    query: {
      handler() {
        this.selectedFilter = this.query.split('&').filter((query) => query);
      },
    },
  },
  async mounted() {
    try {
      const camera = await getCamera(this.$route.params.name);
      const settings = await getCameraSettings(this.$route.params.name);
      let presets;
      if (camera.data.type == 'PTZ') {
        presets = await getCameraPresets(this.$route.params.name);
      }

      camera.data.settings = settings.data;
      console.log(camera);

      const lastNotifications = await getNotifications(`?cameras=${camera.data.name}&pageSize=50`);
      this.notifications = lastNotifications.data.result;
      console.log(this.notifications);
      this.images = lastNotifications.data.result.map((notification) => {
        if (notification.recordStoring) {
          let mediaContainer = {
            id: notification.id,
            type: 'image',
            caption: `${notification.camera} - ${notification.time}`,
            src: `/files/${notification.fileName}`,
            thumb: `/files/${notification.fileName}`,
          };
          if (notification.recordType === 'Video') {
            delete mediaContainer.src;
            mediaContainer = {
              ...mediaContainer,
              type: 'video',
              sources: [
                {
                  src: `/files/${notification.fileName}`,
                  type: 'video/mp4',
                },
              ],
              thumb: `/files/${notification.name}@2.jpeg`,
              width: '100%',
              height: 'auto',
              autoplay: true,
            };
          }
          return mediaContainer;
        }
      });
      this.camera = camera.data;
      this.loading = false;
      if (presets.data.statusCode == null) {
        console.log(presets.data);
        this.cameraPresets = presets.data;
      }
      await timeout(10);
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },
  created() {
    this.pollData();
  },
  beforeDestroy() {
    //this.$socket.client.off('getCameraTemps', this.camTemps);
    clearInterval(this.polling);
    bus.$off('showFilterOverlay', this.triggerFilterOverlay);
  },
  methods: {
    triggerFilterOverlay(state) {
      this.showOverlay = state;
    },
    toggleFilterNavi() {
      this.showOverlay = !this.showOverlay;
      bus.$emit('showFilterNavi', true);
    },
    filter(filterQuery) {
      if (this.query !== filterQuery) {
        this.loading = true;
        this.page = 1;
        this.query = filterQuery;
        this.infiniteId = Date.now();
        this.loading = false;
      }
    },
    groupBy(array, f) {
      let groups = {};
      array.forEach(function (o) {
        var group = JSON.stringify(f(o));
        groups[group] = groups[group] || [];
        groups[group].push(o);
      });
      return Object.keys(groups).map(function (group) {
        return groups[group];
      });
    },
    openGallery(notification) {
      if (notification.recordStoring) {
        const index = this.images.findIndex((el) => el.id === notification.id);
        this.$refs.lightbox.showImage(index);
      }
    },
    toggleNotificationsPanel() {
      this.showNotifications = !this.showNotifications;
      if (this.showNotifications) {
        this.notificationsPanel = [0];
      } else {
        this.notificationsPanel = [];
      }
    },
    camTemps(data) {
      this.camTempData.datasets = [];
      this.camTempData.datasets = data;
    },
    exportDataEngine(data) {
      this.exportData = [];
      data.forEach((region) => {
        region.data.forEach((point) => {
          var temp = {
            averageTemperature: point.value,
            time: point.time,
            regionName: region.label,
          };
          this.exportData.push(temp);
        });
      });
    },

    tempLimits(tempLists) {
      var minTemp = 100;
      var maxTemp = 0;
      tempLists.forEach((tempList) => {
        var instanceMax = Math.max(...tempList.data.map((x) => parseInt(x.value, 10)));
        var instanceMin = Math.min(...tempList.data.map((x) => parseInt(x.value, 10)));
        if (instanceMax > maxTemp) {
          maxTemp = instanceMax;
          console.log(`Found the max temp ${maxTemp}`);
        }
        if (instanceMin < minTemp) {
          minTemp = instanceMin;
          console.log(`Found the min temp ${minTemp}`);
        }
      });

      this.camTempsOptions.scales.yAxes[0].ticks.min = minTemp - 3;
      this.camTempsOptions.scales.yAxes[0].ticks.max = maxTemp + 3;
      this.camTempsOptions.scales.yAxes[0].ticks.stepSize = 1;
      this.camTempsOptions.scales.yAxes[0].display = true;

      console.log(`${this.camTempsOptions.scales.yAxes[0]}`);
    },
    pollData() {
      this.polling = setInterval(async () => {
        let today = new Date();
        const offset = today.getTimezoneOffset();
        today = new Date(today.getTime() - offset * 60 * 1000);
        var results = [];
        var datasets = [];
        console.log(this.camera);
        console.log(this.query);
        if (!this.query) {
          this.temperatures = await getTemperatures(`?cameras=${this.camera.name}&pageSize=5000&from=${
            today.toISOString().split('T')[0]
          }&to=${today.toISOString().split('T')[0]}
        `);
        } else {
          this.temperatures = await getTemperatures(`?cameras=${this.camera.name}&pageSize=5000${this.query}
        `);
        }
        results = this.groupBy(this.temperatures.data.result, function (item) {
          return [item.preset, item.region];
        });
        for (let index = 0; index < results.length; index++) {
          const element = results[index];
          var d = {
            label: `${element[0].preset == 1 ? '' : element[0].preset + '-'} ${element[0].region}`,
            data: element.map(function (i) {
              return { time: i.time, value: i.maxTemp };
            }),
          };
          datasets.push(d);
        }
        console.log(datasets);
        this.tempLimits(datasets);
        this.camTemps(datasets);
        this.exportDataEngine(datasets);
      }, 1000);
    },
    getCurrentDate() {
      let today = new Date();
      const offset = today.getTimezoneOffset();
      today = new Date(today.getTime() - offset * 60 * 1000);
      this.query = `&from=${today.toISOString().split('T')[0]}&to=${today.toISOString().split('T')[0]}`;
    },
    modifyInterval(value) {
      this.camTempsOptions.scales.xAxes[0].time.unitStepSize = value;
    },
    goToPreset(id) {
      goToCameraPreset(this.$route.params.name, id);
    },
  },
};
</script>

<style scoped>
@media screen and (min-width: 960px) {
  .filter-content {
    padding-left: 320px;
  }

  .filter-cleanup {
    display: none;
  }
}

.subtitle {
  color: rgba(var(--cui-text-third-rgb)) !important;
}

.notifications-panel {
  background: rgba(var(--cui-bg-card-rgb)) !important;
}

.notifications-panel-content {
  color: rgba(var(--cui-text-default-rgb));
}

.notification-item {
  border-bottom: 1px solid rgba(var(--cui-text-default-rgb), 0.1);
}

div >>> .v-badge__badge {
  font-size: 8px;
  height: 15px;
  min-width: 15px;
  padding: 3px 3px;
}

div >>> .theme--light.v-btn.v-btn--disabled .v-icon {
  color: rgba(var(--cui-text-default-rgb), 0.4) !important;
}

div >>> .v-expansion-panel-content__wrap {
  padding: 0;
}

div >>> .theme--light.v-expansion-panels .v-expansion-panel-header .v-expansion-panel-header__icon .v-icon {
  color: rgba(var(--cui-text-default-rgb)) !important;
}
</style>
