<template lang="pug">
div
  .grid-stack-item(v-for="(placeholder,i) in placeholders" :key="placeholder.id" :gs-id="placeholder.id" :gs-type="placeholder.type" :gs-w="placeholder.w" :gs-min-w="placeholder.minW" :gs-max-w="placeholder.maxW" :gs-h="placeholder.h" :gs-min-h="placeholder.minH" :gs-max-h="placeholder.maxH" :gs-no-resize="placeholder.disableResize" :gs-no-move="placeholder.disableDrag")
    .grid-stack-item-content
      .content.tw-relative.tw-overflow-hidden(:class="i !== placeholders.length - 1 ? 'tw-mb-3' : ''")
        .chart-badge.tw-flex.tw-justify-center.tw-items-center.text-default(v-if="placeholder.id === 'cpuLoad'") 8%
        .chart-badge.tw-flex.tw-justify-center.tw-items-center.text-default(v-if="placeholder.id === 'cpuTemperature'") 50°
        .chart-badge.tw-flex.tw-justify-center.tw-items-center.text-default(v-if="placeholder.id === 'memory'") 4.34 GB / 8GB
        Chart(:dataset="placeholder.id === 'cpuLoad' ? cpuData : placeholder.id === 'cpuTemperature' ? tempData : memoryData" :options="chartOptions")
        
</template>

<script>
/* eslint-disable vue/require-default-prop */
import Chart from '@/components/utilization-charts.vue';

export default {
  name: 'ChartPlaceholder',

  components: {
    Chart,
  },

  props: {
    items: Array,
    dataset: Object,
    widgets: Array,
    type: String,
  },

  data() {
    return {
      placeholders: [],

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

      chartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        elements: {
          point: {
            radius: 0,
          },
        },
        legend: {
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
    };
  },

  watch: {
    items: {
      handler() {
        const placeholders = [];

        this.widgets.forEach((widget) => {
          const itemDropped = this.items.some((item) => item.id === widget.id);

          if (!itemDropped) {
            placeholders.push({
              id: widget.id,
              type: this.type,
              ...this.dataset,
            });
          }
        });

        this.placeholders = placeholders;
      },
      deep: true,
    },
  },

  created() {
    for (let i = 0; i <= 40; i++) {
      this.cpuData.data.push({
        time: i,
        value: this.getRandomInt(5, 15),
      });

      this.memoryData.data.push({
        time: i,
        value: this.getRandomInt(50, 55),
      });

      this.tempData.data.push({
        time: i,
        value: this.getRandomInt(40, 70),
      });
    }
  },

  mounted() {
    this.widgets.forEach((widget) => {
      const itemDropped = this.items.some((item) => item.id === widget.id);

      if (!itemDropped) {
        this.placeholders.push({
          id: widget.id,
          type: this.type,
          ...this.dataset,
        });
      }
    });
  },

  methods: {
    getRandomInt(min, max) {
      return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min))) + Math.ceil(min);
    },
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 150px;
  background: var(--cui-bg-default);
  border-radius: 10px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
}

.widget {
  min-height: 80px;
}

.chart-badge {
  font-size: 1.8rem;
  position: absolute;
  width: 100%;
  height: 100%;
  text-shadow: 1px 0px 0px rgba(0, 0, 0, 0.7);
}
</style>
