import { Line, mixins } from 'vue-chartjs';
const { reactiveProp, reactiveData } = mixins;

export default {
  extends: Line,
  mixins: [reactiveProp, reactiveData],
  props: ['chartData', 'options'],

  mounted() {
    this.renderChart(this.chartData, this.options);
  },
  watch: {
    options: {
      handler() {
        this._data._chart.destroy();
        this.renderChart(this.chartData, this.options);
      },
      deep: true,
    },
  },
};
