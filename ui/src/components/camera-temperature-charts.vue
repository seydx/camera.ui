<template lang="pug">
area-chart(ref="chart" :chart-data="datacollection" :options="options" style="width: 100%; height: 40%")
</template>

<script>
/* eslint-disable vue/require-default-prop */
import AreaChart from '@/charts/area-chart';

export default {
  name: 'CameraTemperatureCharts',

  components: {
    AreaChart,
  },

  props: {
    dataset: Object,
    options: Object,
  },

  data: () => ({
    datacollection: null,
  }),

  computed: {
    chartColorRGB2: function () {
      const color = localStorage.getItem('theme-color') || 'pink';

      switch (color) {
        default:
          return '133, 21, 47';
      }
    },
    chartPointerColorRGB() {
      const darkMode = localStorage.getItem('theme') === 'dark';
      return darkMode ? '#e2e2e2' : '#383838';
    },
    chartPointerColorRGBA() {
      const darkMode = localStorage.getItem('theme') === 'dark';
      return darkMode ? '226, 226, 226' : '56, 56, 56';
    },
  },

  beforeDestroy() {},

  mounted() {
    this.fill();
    this.$watch('dataset', this.fill, { deep: true });
    this.$watch('options', this.fill, { deep: true });
  },

  methods: {
    chartColorRGB: function (value) {
      //const color = localStorage.getItem('theme-color') || 'pink';

      switch (value) {
        case 0:
          return '236,87,133';
        case 1:
          return '79,165,246';
        case 2:
          return '221, 221, 221';
        case 3:
          return '125,189,81';
        case 4:
          return '221,160,55';
        case 5:
          return '236,84,39';
        case 6:
          return '108,210,210';
        case 7:
          return '102,49,166';
        case 8:
          return '38,7,124';
        case 9:
          return '250,250,70';
        case 10:
          return '132,191,237';
        case 11:
          return '0,82,109';
        case 12:
          return '248,31,10';
        default:
          return '209, 32, 73';
      }
    },
    fill() {
      const chartEl = this.$refs.chart;
      var datasets = [];

      this.datacollection = {
        labels: this.dataset.datasets[0].data.map((data) => {
          return data.time;
        }),
      };

      for (var i = 0; i < this.dataset.datasets.length; i++) {
        const gradient = chartEl.$refs.canvas.getContext('2d').createLinearGradient(0, 0, 0, 450);
        gradient.addColorStop(0, `rgba(${this.chartColorRGB(i)}, 0.5)`);
        gradient.addColorStop(0.5, `rgba(${this.chartColorRGB(i)}, 0.25)`);
        gradient.addColorStop(1, `rgba(${this.chartColorRGB(i)}, 0)`);
        var d = {
          label: this.dataset.datasets[i].label,
          fill: false,
          borderColor: `rgb(${this.chartColorRGB(i)})`,
          backgroundColor: `rgb(${this.chartColorRGB(i)})`,
          pointBackgroundColor: this.chartPointerColorRGB,
          borderWidth: 1,
          pointBorderColor: this.chartPointerColorRGB,
          data: this.dataset.datasets[i].data.map((data) => {
            return data.value;
          }),
        };
        datasets.push(d);
      }

      this.datacollection.datasets = datasets;
    },
  },
};
</script>

<style scoped></style>
