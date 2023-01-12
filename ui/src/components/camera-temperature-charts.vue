<template lang="pug">
area-chart(ref="chart" :chart-data="datacollection" :options="options" style="width: 100%; height: 100%")
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
  },

  methods: {
    chartColorRGB: function (value) {
      //const color = localStorage.getItem('theme-color') || 'pink';

      switch (value) {
        case 0:
          return '50, 29, 78';
        case 'blue-alt' || 1:
          return '50, 29, 78';
        case 'blgray' || 2:
          return '96, 125, 139';
        case 'blgray-alt' || 3:
          return '37, 49, 55';
        case 'brown' || 4:
          return '121, 85, 72';
        case 'brown-alt' || 5:
          return '48, 34, 29';
        case 'green' || 6:
          return '102, 206, 102';
        case 'green-alt' || 7:
          return '41, 82, 41';
        case 'gray' || 8:
          return '98, 99, 101';
        case 'gray-alt' || 9:
          return '39, 40, 40';
        case 'orange' || 10:
          return '255, 149, 0';
        case 'orange-alt' || 11:
          return '102, 60, 0';
        case 'pink' || 12:
          return '209, 32, 73';
        case 'pink-alt' || 13:
          return '133, 21, 47';
        case 'purple' || 14:
          return '124, 72, 194';
        case 'purple-alt' || 15:
          return '50, 29, 78';
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
          borderColor: `rgb(${this.chartColorRGB(9)})`,
          pointBackgroundColor: this.chartPointerColorRGB,
          borderWidth: 1,
          pointBorderColor: this.chartPointerColorRGB,
          backgroundColor: gradient,
          data: this.dataset.datasets[i].data.map((data) => {
            return data.value;
          }),
        };
        datasets.push(d);
      }

      this.datacollection.datasets = datasets;

      // const value2 = this.dataset.data.map((data) => data.value2).filter((data) => data);

      // if (value2.length > 1) {
      //   const gradient2 = chartEl.$refs.canvas.getContext('2d').createLinearGradient(0, 0, 0, 450);
      //   gradient2.addColorStop(0, 'rgba(56, 56, 56, 0.5)');
      //   gradient2.addColorStop(0.5, 'rgba(56, 56, 56, 0.25)');
      //   gradient2.addColorStop(1, 'rgba(56, 56, 56, 0)');

      //   this.datacollection.datasets.push({
      //     label: this.dataset.label2,
      //     borderColor: '#383838',
      //     pointBackgroundColor: '#383838',
      //     borderWidth: 1,
      //     pointBorderColor: '#383838',
      //     backgroundColor: gradient2,
      //     data: value2,
      //   });
      // }

      // const value3 = this.dataset.data.map((data) => data.value3).filter((data) => data);

      // if (value3.length > 1) {
      //   const gradient3 = chartEl.$refs.canvas.getContext('2d').createLinearGradient(0, 0, 0, 450);
      //   gradient3.addColorStop(0, 'rgba(56, 56, 56, 0.5)');
      //   gradient3.addColorStop(0.5, 'rgba(56, 56, 56, 0.25)');
      //   gradient3.addColorStop(1, 'rgba(56, 56, 56, 0)');

      //   this.datacollection.datasets.push({
      //     label: this.dataset.label3,
      //     borderColor: '#383838',
      //     pointBackgroundColor: '#383838',
      //     borderWidth: 1,
      //     pointBorderColor: '#383838',
      //     backgroundColor: gradient3,
      //     data: value3,
      //   });
      // }

      // const value4 = this.dataset.data.map((data) => data.value4).filter((data) => data);

      // if (value4.length > 1) {
      //   const gradient4 = chartEl.$refs.canvas.getContext('2d').createLinearGradient(0, 0, 0, 450);
      //   gradient4.addColorStop(0, 'rgba(56, 56, 56, 0.5)');
      //   gradient4.addColorStop(0.5, 'rgba(56, 56, 56, 0.25)');
      //   gradient4.addColorStop(1, 'rgba(56, 56, 56, 0)');

      //   this.datacollection.datasets.push({
      //     label: this.dataset.label4,
      //     borderColor: '#383838',
      //     pointBackgroundColor: '#383838',
      //     borderWidth: 1,
      //     pointBorderColor: '#383838',
      //     backgroundColor: gradient4,
      //     data: value3,
      //   });
      // }
    },
  },
};
</script>

<style scoped></style>
