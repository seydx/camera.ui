<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .pl-safe.pr-safe

    .header.tw-justify-between.tw-items-center.header.tw-relative.tw-z-10.tw-items-stretch
      .tw-block
        h2 {{ $t($route.name.toLowerCase()) }}

    .tw-mt-10.tw-relative
      h3 {{ $t('cpu_load') }}
      .chart-badge-loading.tw-flex.tw-justify-center.tw-items-center(v-if="!cpuData.data.length")
        v-progress-circular(indeterminate color="var(--cui-primary)")
      .chart-badge.tw-flex.tw-justify-center.tw-items-center.tw-text-white {{ cpuData.data.length ? `${Math.round(cpuData.data[cpuData.data.length-1].value)}%` : '0%' }}
      .chart-badge.tw-flex.tw-justify-center.tw-items-center.tw-text-white(style="top: 130px; background: rgb(56, 56, 56)") {{ cpuData.data.length ? `${Math.round(cpuData.data[cpuData.data.length-1].value2)}%` : '0%' }}
      Chart.tw-mt-5(:dataset="cpuData" :options="areacpuLoadOptions")
    
    .tw-mt-10.tw-relative
      h3 {{ $t('cpu_temperature') }}
      .chart-badge-loading.tw-flex.tw-justify-center.tw-items-center(v-if="!tempData.data.length")
        v-progress-circular(indeterminate color="var(--cui-primary)")
      .chart-badge.tw-flex.tw-justify-center.tw-items-center.tw-text-white {{ tempData.data.length ? `${Math.round(tempData.data[tempData.data.length-1].value)}°` : '0°' }}
      Chart.tw-mt-5(:dataset="tempData" :options="areaCpuTempOptions")

    .tw-mt-10.tw-mb-10.tw-relative
      h3 {{ $t('memory_load') }}
      .chart-badge-loading.tw-flex.tw-justify-center.tw-items-center(v-if="!memoryData.data.length")
        v-progress-circular(indeterminate color="var(--cui-primary)")
      .chart-badge.tw-flex.tw-flex-col.tw-justify-center.tw-items-center
        .tw-text-white(style="font-size: 0.8rem !important; font-weight: 100;") {{ memoryData.data.length ? memoryData.data[memoryData.data.length-1].available : '-' }} GB /
        .tw-text-white(style="font-size: 0.9rem !important; font-weight: bolder;") {{ memoryData.data.length ? memoryData.data[memoryData.data.length-1].total : '-' }} GB
      .chart-badge.tw-flex.tw-justify-center.tw-items-center.tw-text-white(style="top: 130px; background: rgb(56, 56, 56)") {{ memoryData.data.length ? `${Math.round(memoryData.data[memoryData.data.length-1].value2)}%` : '0%' }}
      Chart.tw-mt-5(:dataset="memoryData" :options="areaMemoryOptions")

  CoolLightBox(
    :items="notImages" 
    :index="notIndex"
    @close="closeHandler"
    :closeOnClickOutsideMobile="true"
    :useZoomBar="true",
    :zIndex=99999
  )

</template>

<script>
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';
import CoolLightBox from 'vue-cool-lightbox';

import socket from '@/mixins/socket';

import Chart from '@/components/utilization-charts.vue';

export default {
  name: 'Utilization',

  components: {
    Chart,
    CoolLightBox,
  },

  mixins: [socket],

  data() {
    return {
      loading: true,

      cpuData: {
        label: this.$t('load'),
        data: [],
      },
      memoryData: {
        label: this.$t('memory'),
        data: [],
      },
      tempData: {
        label: this.$t('temperature'),
        data: [],
      },

      areacpuLoadOptions: {
        responsive: true,
        maintainAspectRatio: false,
        elements: {
          point: {
            radius: 0,
            hitRadius: 20,
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
              return ` ${tooltipItems.yLabel.toFixed(2)}%`;
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
                unit: 'minutes',
                displayFormats: { minutes: 'HH:mm' },
                unitStepSize: 3,
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
                min: 0,
                max: 100,
                stepSize: 10,
                callback: function (value) {
                  return value + '%';
                },
              },
              type: 'linear',
            },
          ],
        },
      },
      areaCpuTempOptions: {
        responsive: true,
        maintainAspectRatio: false,
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
                unit: 'minutes',
                displayFormats: { minutes: 'HH:mm' },
                unitStepSize: 3,
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
                min: 0,
                max: 100,
                stepSize: 10,
                callback: function (value) {
                  return value + '°';
                },
              },
              type: 'linear',
            },
          ],
        },
      },
      areaMemoryOptions: {
        responsive: true,
        maintainAspectRatio: false,
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
              return ` ${tooltipItems.yLabel.toFixed(2)}%`;
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
                unit: 'minutes',
                displayFormats: { minutes: 'HH:mm' },
                unitStepSize: 3,
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
                min: 0,
                max: 100,
                stepSize: 10,
                callback: function (value) {
                  return value + '%';
                },
              },
              type: 'linear',
            },
          ],
        },
      },
    };
  },

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  created() {
    this.$socket.client.on('cpuLoad', this.cpuLoad);
    this.$socket.client.on('cpuTemp', this.cpuTemp);
    this.$socket.client.on('memory', this.memory);

    this.$socket.client.emit('getCpuLoad');
    this.$socket.client.emit('getCpuTemp');
    this.$socket.client.emit('getMemory');
  },

  mounted() {
    this.loading = false;
  },

  beforeDestroy() {
    this.$socket.client.off('cpuLoad', this.cpuLoad);
    this.$socket.client.off('cpuTemp', this.cpuTemp);
    this.$socket.client.off('memory', this.memory);
  },

  methods: {
    cpuLoad(data) {
      this.cpuData.data = data;
    },
    cpuTemp(data) {
      this.tempData.data = data;
    },
    memory(data) {
      this.memoryData.data = data;
    },
  },
};
</script>

<style scoped>
.chart-badge {
  font-size: 1.6rem;
  position: absolute;
  right: 10px;
  top: 40px;
  background: var(--cui-primary);
  width: 80px;
  height: 80px;
  border-radius: 50px;
  text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.2);
}

.chart-badge-loading {
  position: absolute;
  width: 100%;
  height: 100%;
}
</style>
