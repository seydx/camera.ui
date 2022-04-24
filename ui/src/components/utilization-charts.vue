<template lang="pug">
area-chart(ref="chart" :chart-data="datacollection" :options="options" style="width: 100%; height: 100%")
</template>

<script>
/* eslint-disable vue/require-default-prop */
import AreaChart from '@/charts/area-chart';

export default {
  name: 'UtilizationCharts',

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
    chartColorRGB() {
      const color = localStorage.getItem('theme-color') || 'pink';

      switch (color) {
        case 'blue':
          return '10, 132, 255';
        case 'blgray':
          return '96, 125, 139';
        case 'brown':
          return '121, 85, 72';
        case 'green':
          return '102, 206, 102';
        case 'gray':
          return '98, 99, 101';
        case 'orange':
          return '255, 149, 0';
        case 'pink':
          return '209, 32, 73';
        case 'purple':
          return '124, 72, 194';
        default:
          return '209, 32, 73';
      }
    },
    chartColorRGB2() {
      const color = localStorage.getItem('theme-color') || 'pink';

      switch (color) {
        case 'blue':
          return '4, 53, 102';
        case 'blgray':
          return '37, 49, 55';
        case 'brown':
          return '48, 34, 29';
        case 'green':
          return '41, 82, 41';
        case 'gray':
          return '39, 40, 40';
        case 'orange':
          return '102, 60, 0';
        case 'pink':
          return '133, 21, 47';
        case 'purple':
          return '50, 29, 78';
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
    fill() {
      const chartEl = this.$refs.chart;

      const gradient = chartEl.$refs.canvas.getContext('2d').createLinearGradient(0, 0, 0, 450);
      gradient.addColorStop(0, `rgba(${this.chartColorRGB}, 0.5)`);
      gradient.addColorStop(0.5, `rgba(${this.chartColorRGB}, 0.25)`);
      gradient.addColorStop(1, `rgba(${this.chartColorRGB}, 0)`);

      this.datacollection = {
        labels: this.dataset.data.map((data) => {
          return data.time;
        }),
        datasets: [
          {
            label: this.dataset.label,
            borderColor: `rgb(${this.chartColorRGB})`,
            pointBackgroundColor: this.chartPointerColorRGB,
            borderWidth: 1,
            pointBorderColor: this.chartPointerColorRGB,
            backgroundColor: gradient,
            data: this.dataset.data.map((data) => {
              return data.value;
            }),
          },
        ],
      };

      const value2 = this.dataset.data.map((data) => data.value2).filter((data) => data);

      if (value2.length > 1) {
        const gradient2 = chartEl.$refs.canvas.getContext('2d').createLinearGradient(0, 0, 0, 450);
        gradient2.addColorStop(0, 'rgba(56, 56, 56, 0.5)');
        gradient2.addColorStop(0.5, 'rgba(56, 56, 56, 0.25)');
        gradient2.addColorStop(1, 'rgba(56, 56, 56, 0)');

        this.datacollection.datasets.push({
          label: this.dataset.label2,
          borderColor: '#383838',
          pointBackgroundColor: '#383838',
          borderWidth: 1,
          pointBorderColor: '#383838',
          backgroundColor: gradient2,
          data: value2,
        });
      }
    },
  },
};
</script>

<style scoped></style>
