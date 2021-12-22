<template lang="pug">
.widgets-navi.pr-safe.tw-flex.tw-flex-col.tw-h-full(:class="(showSidebar ? 'widgets-navi-show ' : '')" v-click-outside="{ handler: hideNavi, include: include }")
  .widgets.tw-p-3
    .widgets-navi-title.tw-py-3.tw-mb-5
      h3 {{ $t('widgets') }}
    .tw-flex.tw-items-center.tw-justify-center(v-if="loading")
      v-progress-circular.tw-mt-5(indeterminate color="var(--cui-primary)" size="20")
    .widget(v-for="(widget,i) in widgets" :key="widget.name" v-if="!loading && !widget.items.every((widgetItem) => items.some((item) => item.id === widgetItem.id))" :class="i !== widgets.length - 1 ? 'tw-mb-10' : ''")
      .widget-title.tw-mb-2.tw-ml-2 {{ widget.name }}
      component(:is="widget.placeholderComponent" :items="items" :widgets="widget.items" @refreshDrag="$emit('refreshDrag')")

</template>

<script>
/* eslint-disable vue/require-default-prop */
import { bus } from '@/main';

import { CameraPlaceholder, CameraWidget } from '@/widgets/camera';
import { ConsolePlaceholder, ConsoleWidget } from '@/widgets/console';
import { NotificationsPlaceholder, NotificationsWidget } from '@/widgets/notifications';
import { ChartPlaceholder, ChartWidget } from '@/widgets/chart';
import { ShortcutsPlaceholder, ShortcutsWidget } from '@/widgets/shortcuts';
import { StatusPlaceholder, StatusWidget } from '@/widgets/status';
import { TimePlaceholder, TimeWidget } from '@/widgets/time';
import { WeatherPlaceholder, WeatherWidget } from '@/widgets/weather';
import { UptimePlaceholder, UptimeWidget } from '@/widgets/uptime';

export default {
  name: 'SidebarWidgets',

  props: {
    items: Array,
  },

  data() {
    return {
      loading: true,
      locked: false,

      showSidebar: false,

      widgets: [
        {
          name: this.$t('time'),
          placeholderComponent: TimePlaceholder.default,
          widgetComponent: TimeWidget.default,
          items: [
            {
              id: 'time',
            },
          ],
        },
        {
          name: this.$t('weather'),
          placeholderComponent: WeatherPlaceholder.default,
          widgetComponent: WeatherWidget.default,
          items: [
            {
              id: 'weather',
            },
          ],
        },
        {
          name: this.$t('uptime'),
          placeholderComponent: UptimePlaceholder.default,
          widgetComponent: UptimeWidget.default,
          items: [
            {
              id: 'uptime',
            },
          ],
        },
        {
          name: this.$t('cameras'),
          placeholderComponent: CameraPlaceholder.default,
          widgetComponent: CameraWidget.default,
          items: [],
        },
        {
          name: this.$t('notifications'),
          placeholderComponent: NotificationsPlaceholder.default,
          widgetComponent: NotificationsWidget.default,
          items: [
            {
              id: 'notifications',
            },
          ],
        },
        {
          name: this.$t('status'),
          placeholderComponent: StatusPlaceholder.default,
          widgetComponent: StatusWidget.default,
          items: [
            {
              id: 'status',
            },
          ],
        },
        {
          name: this.$t('shortcuts'),
          placeholderComponent: ShortcutsPlaceholder.default,
          widgetComponent: ShortcutsWidget.default,
          items: [
            {
              id: 'shortcuts',
            },
          ],
        },
        {
          name: this.$t('utilization'),
          placeholderComponent: ChartPlaceholder.default,
          widgetComponent: ChartWidget.default,
          items: [
            {
              id: 'cpuLoad',
            },
            {
              id: 'cpuTemperature',
            },
            {
              id: 'memory',
            },
          ],
        },
        {
          name: this.$t('console'),
          placeholderComponent: ConsolePlaceholder.default,
          widgetComponent: ConsoleWidget.default,
          items: [
            {
              id: 'console',
            },
          ],
        },
      ],
    };
  },

  watch: {
    '$route.path': {
      handler() {
        if (this.showSidebar) {
          this.hideNavi();
        }
      },
    },
  },

  created() {
    bus.$on('showWidgetsNavi', this.toggleWidgetsNavi);
  },

  async mounted() {
    this.loading = false;
  },

  beforeDestroy() {
    bus.$off('showWidgetsNavi', this.toggleWidgetsNavi);
  },

  methods: {
    include() {
      return [...document.querySelectorAll('.widgets-included')];
    },
    hideNavi() {
      this.showSidebar = false;
    },
    toggleWidgetsNavi(state) {
      if (state !== undefined) {
        this.showSidebar = state;
      } else {
        this.showSidebar = !this.showSidebar;
      }
    },
  },
};
</script>

<style scoped>
.widgets-navi {
  background: rgba(var(--cui-bg-app-bar-rgb));
  position: fixed;
  overflow-y: scroll;
  overflow-x: hidden;
  top: calc(64px + env(safe-area-inset-top, 0px));
  bottom: 0;
  width: calc(320px + env(safe-area-inset-left, 0px));
  min-width: calc(320px + env(safe-area-inset-left, 0px));
  max-width: calc(320px + env(safe-area-inset-left, 0px));
  height: calc(100vh - 64px - env(safe-area-inset-top, 0px));
  min-height: calc(100vh - 64px - env(safe-area-inset-top, 0px));
  max-height: calc(100vh - 64px - env(safe-area-inset-top, 0px));
  transition: 0.3s all;
  z-index: 98;
  right: -600px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  border-left: 1px solid rgba(var(--cui-bg-settings-border-rgb)) !important;
  box-shadow: none !important;
}

.widgets-navi::-webkit-scrollbar {
  width: 0px;
  display: none;
}

.widgets-navi-show {
  right: 0 !important;
}

.widgets-navi-title {
  /* background: rgba(var(--cui-bg-default-rgb), 0.5) !important; */
  border-bottom: 1px solid var(--cui-bg-settings-border) !important;
}

.widgets >>> .widget-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--cui-text-default);
}

.widget >>> .grid-stack-item {
  cursor: pointer;
}

@media (max-width: 960px) {
  .widgets-navi {
    /*position: fixed;*/
    right: -600px;
  }
  .widgets-navi-show {
    right: 0 !important;
  }
}
</style>
