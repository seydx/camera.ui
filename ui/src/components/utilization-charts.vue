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
    chartPointerColorRGB() {
      const darkMode = localStorage.getItem('theme') === 'dark';
      return darkMode ? '#e2e2e2' : '#383838';
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
    },
  },
};
</script>

<style scoped></style>
