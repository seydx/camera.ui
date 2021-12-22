import { Line, mixins } from 'vue-chartjs';
const { reactiveProp } = mixins;

export default {
  extends: Line,
  mixins: [reactiveProp],
  props: ['chartData', 'options'],

  mounted() {
    this.renderChart(this.chartData, this.options);
  },
};
