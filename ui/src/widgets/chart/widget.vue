<template lang="pug">
.content
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  .chart-content.tw-relative.tw-overflow-hidden(v-else)
    .tw-text-xs.tw-absolute.tw-top-2.tw-left-2.tw-font-bold.text-muted {{ dataset.label ? dataset.label : '' }}
    .chart-badge.tw-flex.tw-justify-center.tw-items-center.text-default(v-if="item.id === 'cpuLoad'") {{ dataset.data.length ? `${Math.round(dataset.data[dataset.data.length-1].value)}%` : '' }}
    .chart-badge.tw-flex.tw-justify-center.tw-items-center.text-default(v-if="item.id === 'cpuTemperature'") {{ dataset.data.length ? `${Math.round(dataset.data[dataset.data.length-1].value)}°` : '' }}
    .chart-badge.tw-flex.tw-justify-center.tw-items-center.text-default(v-if="item.id === 'memory'" style="font-size: 1.3rem !important;") {{ dataset.data.length ? dataset.data[dataset.data.length-1].available : '-' }} GB / {{ dataset.data.length ? dataset.data[dataset.data.length-1].total : '-' }} GB
    Chart(:dataset="dataset" :options="chartOptions")
</template>

<script>
/* eslint-disable vue/require-default-prop */
import Chart from '@/components/utilization-charts.vue';

export default {
  name: 'ChartWidget',

  components: {
    Chart,
  },

  props: {
    item: Object,
  },

  data: () => ({
    loading: true,

    dataset: {
      label: '',
      data: [],
    },

    chartOptions: {
      responsive: true,
      maintainAspectRatio: false,
      elements: {
        point: {
          radius: 0,
        },
      },
      legend: {
        display: false,
        labels: {
          boxWidth: 0,
        },
      },
      tooltips: {
        enabled: false,
      },
      scales: {
        xAxes: [
          {
            display: false,
            gridLines: {
              display: false,
            },
            scaleLabel: {
              display: false,
            },
          },
        ],
        yAxes: [
          {
            display: false,
            gridLines: {
              display: false,
            },
            scaleLabel: {
              display: false,
            },
            ticks: {
              min: 0,
              max: 100,
              stepSize: 10,
            },
            type: 'linear',
          },
        ],
      },
    },
  }),

  mounted() {
    if (this.item.id === 'cpuLoad') {
      this.dataset.label = this.$t('load');

      this.$socket.client.on('cpuLoad', this.cpuLoad);
      this.$socket.client.emit('getCpuLoad');
    } else if (this.item.id === 'cpuTemperature') {
      this.dataset.label = this.$t('temperature');

      this.$socket.client.on('cpuTemp', this.cpuTemp);
      this.$socket.client.emit('getCpuTemp');
    } else {
      this.dataset.label = this.$t('memory');

      this.$socket.client.on('memory', this.memory);
      this.$socket.client.emit('getMemory');
    }

    this.loading = false;
  },

  beforeDestroy() {
    if (this.item.id === 'cpuLoad') {
      this.$socket.client.off('cpuLoad', this.cpuLoad);
    } else if (this.item.id === 'cpuTemperature') {
      this.$socket.client.off('cpuTemp', this.cpuTemp);
    } else {
      this.$socket.client.off('memory', this.memory);
    }
  },

  methods: {
    cpuLoad(data) {
      this.dataset.data = data;
    },
    cpuTemp(data) {
      this.dataset.data = data;
    },
    memory(data) {
      this.dataset.data = data;
    },
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  border-radius: 13px;
  background: var(--cui-bg-default);
  border: 1px solid var(--cui-bg-app-bar-border);
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
}

.widget {
}

.chart-content {
  width: 100%;
  height: 100%;
  border-radius: 13px;
  overflow: hidden;
}

.chart-badge {
  font-size: 1.8rem;
  position: absolute;
  width: 100%;
  height: 100%;
  text-shadow: 1px 0px 0px rgba(0, 0, 0, 0.7);
}
</style>
