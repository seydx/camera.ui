<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-3(v-else)
  .pl-safe.pr-safe

    Sidebar(ref="widgetBar" :items="items" @refreshDrag="setupDrag")
  
    .tw-flex.tw-justify-between.tw-items-center
      .tw-block(style="margin-left: 10px;")
        h2.tw-leading-10 {{ $t($route.name.toLowerCase()) }}
        span.tw-leading-3.subtitle {{ $t('welcome_back') }}, 
          b {{ currentUser.username }}

      .tw-block.widgets-included.tw-ml-auto.tw-mr-1(v-if="!showWidgetsNavi")
        v-btn.text-muted.tw-mr-1(icon height="38px" width="38px" @click="toggleLock" :color="locked ? 'error' : 'var(--cui-text-hint)'")
          v-icon {{ locked ? icons['mdiLock'] : icons['mdiLockOpen'] }}

      .tw-block.widgets-included(v-if="!showWidgetsNavi")
        v-btn.text-muted.tw-mr-1(icon height="38px" width="38px" @click="toggleWidgetsNavi")
          v-icon {{ icons['mdiWidgets'] }}
    
    #dashboard.tw-mt-5.tw-relative.tw-max-w-10xl(:class="itemChange || !items.length ? 'grid-stack-dragging-border' : ''")
      .drag-info.tw-text-center(v-if="!items.length") {{ $t('drop_widgets_here') }}
      .grid-stack(ref="gridStack")
          
  LightBox(
    ref="lightboxBanner"
    :media="notImages"
    :showLightBox="false"
    :showThumbs="false"
    showCaption
    disableScroll
  )

</template>

<script>
import Vue from 'vue';
import { i18n } from '@/i18n';
import vuetify from '@/plugins/vuetify';
import router from '@/router';
import store from '@/store';

import LightBox from 'vue-it-bigger';
import 'vue-it-bigger/dist/vue-it-bigger.min.css';
import 'gridstack/dist/jq/gridstack-dd-jqueryui';
import 'gridstack/dist/gridstack.min.css';
import 'gridstack/dist/gridstack-extra.min.css';
import { GridStack } from 'gridstack';
import { mdiLock, mdiLockOpen, mdiWidgets } from '@mdi/js';

import { getCameras, getCameraSettings } from '@/api/cameras.api';
import { getSetting, changeSetting } from '@/api/settings.api';

import { bus } from '@/main';
import socket from '@/mixins/socket';
import Sidebar from '@/components/sidebar-widgets.vue';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Dashboard',

  components: {
    LightBox,
    Sidebar,
  },

  mixins: [socket],

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  data: () => ({
    itemChange: false,

    icons: {
      mdiLock,
      mdiLockOpen,
      mdiWidgets,
    },

    instances: {},
    items: [],
    widgets: [],
    widgetsTimeout: null,

    cameras: [],
    notifications: [],

    loading: true,
    locked: false,
    showWidgetsNavi: false,

    resizedBack: false,
  }),

  computed: {
    currentUser() {
      return this.$store.state.auth.user || {};
    },
  },

  async mounted() {
    try {
      const cameras = await getCameras();

      for (const camera of cameras.data.result) {
        camera.id = camera.name;
        const settings = await getCameraSettings(camera.name);
        camera.settings = settings.data;
        camera.live = camera.settings.dashboard.live || false;
        camera.refreshTimer = camera.settings.dashboard.refreshTimer || 60;
      }

      const widgets = await getSetting('widgets');
      this.items = widgets.data.items;
      this.locked = widgets.data.options.locked;
      this.showWidgetsNavi = this.windowWidth() < 768;

      this.loading = false;

      await timeout(100);

      this.$refs.widgetBar.widgets.forEach((widget) => {
        if (widget.type === 'CamerasWidget') {
          widget.items = cameras.data.result;
        }
      });

      this.widgets = this.$refs.widgetBar.widgets;

      this.items = this.items.map((item) => {
        const widget = this.widgets.find((widget) => widget.items.some((widgetItem) => widgetItem.id === item.id));

        return {
          ...item,
          minW: widget.defaultWidgetData.minW,
          maxW: widget.defaultWidgetData.maxW,
          minH: widget.defaultWidgetData.minH,
          maxH: widget.defaultWidgetData.maxH,
          disableDrag: widget.defaultWidgetData.disableDrag,
          disableResize: widget.defaultWidgetData.disableResize,
        };
      });

      this.grid = GridStack.init({
        alwaysShowResizeHandle: this.isMobile(),
        disableOneColumnMode: true,
        acceptWidgets: true,
        float: true,
        column: 12,
        cellHeight: this.cellHeight(),
        margin: 10,
        removable: true,
        resizable: {
          autoHide: !this.isMobile(),
          handles: 'all',
        },
      });

      if (this.locked) {
        this.grid.disable();
      } else {
        this.grid.enable();
      }

      // eslint-disable-next-line no-unused-vars
      this.grid.on('drag dragstart resizestart', (event) => {
        this.toggleWidgetsNavi(false);
        this.itemChange = true;
      });

      // eslint-disable-next-line no-unused-vars
      this.grid.on('dropped dragstop resizestop', (event, previousWidget, newWidget) => {
        if (event.type === 'dropped') {
          this.setupDrag();

          const itemsCopy = [...this.items];

          const item = {
            id: newWidget.id,
            type: newWidget.el.getAttribute('gs-type'),
            x: newWidget.x,
            y: newWidget.y,
            w: newWidget.w,
            minW: newWidget.minW,
            maxW: newWidget.maxW,
            h: newWidget.h,
            minH: newWidget.minH,
            maxH: newWidget.maxH,
            noMove: newWidget.noMove,
            noResize: newWidget.noResize,
          };

          this.grid.removeWidget(newWidget.el, true, false);

          const instance = this.createInstance(newWidget.id);

          if (instance) {
            this.grid.addWidget({
              ...item,
              content: instance.div.outerHTML,
            });

            itemsCopy.push(item);

            document.getElementById(instance.div.id).appendChild(instance.instance.$el);
          }

          this.items = itemsCopy;
        }

        this.itemChange = false;
      });

      // eslint-disable-next-line no-unused-vars
      this.grid.on('change', (event, changedItems) => {
        if (this.grid.getColumn() === 12 && changedItems && !this.resizedBack) {
          let items = [...this.items];
          const changedItemsCopy = [...changedItems];

          changedItemsCopy.forEach((changedItem) => {
            const item = items.find((item) => item.id === changedItem.id);
            items = items.filter((item) => item.id !== changedItem.id);

            items.push({
              ...item,
              x: changedItem.x,
              y: changedItem.y,
              w: changedItem.w,
              h: changedItem.h,
            });
          });

          this.items = items;
        }
      });

      this.grid.on('removed', async (event, items) => {
        this.items = this.items.filter((item) => item.id !== items[0].id);
        this.destroyInstance(items[0].id);

        await timeout(100);
        this.setupDrag();
      });

      this.createLayout();
      this.setupDrag();
      this.onResize();

      ['resize', 'orientationchange'].forEach((event) => {
        window.addEventListener(event, this.onResize);
      });

      this.$watch('items', this.widgetsWatcher, { deep: true });
      this.$watch('locked', this.lockWatcher, { deep: true });
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    ['resize', 'orientationchange'].forEach((event) => {
      window.removeEventListener(event, this.onResize);
    });

    if (this.grid) {
      this.grid.destroy();
    }

    this.destroyInstance();
  },

  methods: {
    cellHeight() {
      const width = this.windowWidth() < 1100 ? this.windowWidth() : 1100;
      return width / 12 < 75 ? 75 : width / 12;
    },
    createInstance(id) {
      const widget = this.$refs.widgetBar.widgets.find((widget) => widget.items.some((item) => item.id === id));

      if (widget) {
        const item = widget.items.find((item) => item.id === id);

        const ComponentClass = Vue.extend(widget.widgetComponent);

        const instance = new ComponentClass({
          router,
          store,
          vuetify,
          i18n: i18n,
          propsData: { item: item, grid: this.grid },
        });

        const div = document.createElement('div');
        div.id = Math.random().toString(24).substring(8);
        div.classList.add('tw-h-full', 'tw-w-full', 'tw-relative', 'tw-z-1');

        instance.$on('refreshDrag', this.setupDrag);
        instance.$on('widgetData', this.widgetData);

        instance.$mount(div);

        this.instances[id] = instance;

        return { instance: instance, div: div };
      }

      return null;
    },
    async createLayout() {
      this.items = this.items.filter((item) => {
        const instance = this.createInstance(item.id);

        if (instance) {
          item.content = instance.div.outerHTML;
          this.grid.addWidget(item);
          document.getElementById(instance.div.id).appendChild(instance.instance.$el);
          return item;
        }
      });
    },
    destroyInstance(id) {
      if (id) {
        this.instances[id]?.$destroy();
        delete this.instances[id];
      } else {
        for (const instance of Object.keys(this.instances)) {
          this.instances[instance].$destroy();
        }
      }
    },
    isMobile() {
      return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.platform) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      );
    },
    async lockWatcher() {
      try {
        await changeSetting('widgets', {
          options: {
            locked: this.locked,
          },
        });
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    async onResize() {
      this.toggleWidgetsNavi(false);
      this.showWidgetsNavi = this.windowWidth() < 768;

      if (this.grid) {
        const items = [...this.items];

        if (this.windowWidth() < 576 && this.grid.getColumn() !== 1) {
          this.grid.margin('10px 0px 10px 0px');
          this.grid.column(1).cellHeight(100).compact().disable();
        } else if (this.windowWidth() >= 576 && this.windowWidth() < 768 && this.grid.getColumn() !== 2) {
          this.grid.margin('10px 5px 10px 5px');
          this.grid.column(2).cellHeight(75).compact().disable();
        } else if (this.windowWidth() >= 768 && this.grid.getColumn() !== 12) {
          this.resizedBack = true;

          this.grid.margin('10px 10px 10px 10px');
          this.grid.column(12).cellHeight(this.cellHeight());

          if (this.locked) {
            this.grid.disable();
          } else {
            this.grid.enable();
          }

          const gridItems = this.grid.getGridItems();
          items.forEach((item) => {
            const el = gridItems.find((el) => el.gridstackNode.id === item.id);
            el.setAttribute('gs-x', item.x);
            el.setAttribute('gs-y', item.y);
            el.setAttribute('gs-w', item.w);
            el.setAttribute('gs-h', item.h);
            this.grid.batchUpdate();
          });

          this.grid.commit();

          this.resizedBack = false;
        }
      }
    },
    setupDrag() {
      GridStack.setupDragIn('.widget .grid-stack-item', {
        revert: 'invalid',
        scroll: false,
        appendTo: '.grid-stack',
        helper: (e) => {
          return e.target.closest('.grid-stack-item').cloneNode(true);
        },
      });
    },
    toggleLock() {
      this.locked = !this.locked;

      if (this.locked) {
        this.grid.disable();
      } else {
        this.grid.enable();
      }
    },
    toggleWidgetsNavi(state) {
      bus.$emit('showWidgetsNavi', state);
      this.setupDrag();
    },
    windowWidth() {
      return window.innerWidth && document.documentElement.clientWidth
        ? Math.min(window.innerWidth, document.documentElement.clientWidth)
        : window.innerWidth ||
            document.documentElement.clientWidth ||
            document.getElementsByTagName('body')[0].clientWidth;
    },
    windowHeight() {
      return document.getElementById('dashboard')?.offsetHeight;
    },
    widgetData(widget) {
      this.items = this.items.map((item) => {
        if (item.id === widget.id) {
          return {
            ...item,
            ...widget.data,
          };
        }

        return item;
      });
    },
    async widgetsWatcher(items) {
      if (this.widgetsTimeout) {
        clearTimeout(this.widgetsTimeout);
        this.widgetsTimeout = null;
      }

      items.forEach((item) => {
        delete item.minW;
        delete item.maxW;
        delete item.minH;
        delete item.maxH;
        delete item.disableDrag;
        delete item.disableResize;
        delete item.content;
      });

      this.widgetsTimeout = setTimeout(async () => {
        try {
          await changeSetting('widgets', {
            items: items,
          });
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }
      }, 250);
    },
  },
};
</script>

<style scoped>
.subtitle {
  color: rgba(var(--cui-text-third-rgb)) !important;
}

.drag-info {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(var(--cui-text-default-rgb), 0.03);
  font-weight: bolder;
  font-size: 1.5rem;
}

.grid-stack {
  /* 100vh - navbar - saveAreaTop - paddingTop - paddingBottom - title - footer */
  min-height: calc(
    100vh - 64px - env(safe-area-inset-top, 12px) - env(safe-area-inset-bottom, 12px) - 1.5rem - 1.5rem - 64px - 44px -
      50px
  );
}

.grid-stack-dragging-border {
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='10' ry='10' stroke='%2371717133' stroke-width='4' stroke-dasharray='6%2c 14' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
  border-radius: 10px;
}

.grid-stack >>> .grid-stack-item-content {
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0px 0px 10px 3px rgb(0 0 0 / 10%);
}

.grid-stack >>> .grid-stack-placeholder {
  /*border: 2px solid var(--cui-bg-disabled) !important;*/
}

.grid-stack >>> .placeholder-content {
  border: none !important;
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='10' ry='10' stroke='%2371717133' stroke-width='4' stroke-dasharray='6%2c 14' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
  border-radius: 10px;
  background-color: rgba(var(--cui-text-default-rgb), 0.05) !important;
}

.grid-stack >>> .ui-resizable-ne {
  transform: none;
  background: none;
  right: 10px !important;
  top: 10px !important;
  width: 20px;
  height: 20px;
  z-index: 2 !important;
}

.grid-stack >>> .ui-resizable-nw {
  transform: none;
  background: none;
  left: 10px !important;
  top: 10px !important;
  width: 20px;
  height: 20px;
  z-index: 2 !important;
}

.grid-stack >>> .ui-resizable-se {
  transform: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='width:24px;height:24px' viewBox='0 0 24 24'%3E%3Cpath fill='rgba(109, 109, 109, 0.397)' d='M22,22H20V20H22V22M22,18H20V16H22V18M18,22H16V20H18V22M18,18H16V16H18V18M14,22H12V20H14V22M22,14H20V12H22V14Z' /%3E%3C/svg%3E");
  background-size: 100%;
  background-position: -5px -5px;
  right: 10px !important;
  bottom: 10px !important;
  width: 20px;
  height: 20px;
  z-index: 2 !important;
}

.grid-stack >>> .ui-resizable-sw {
  transform: none;
  background: none;
  left: 10px !important;
  bottom: 10px !important;
  width: 20px;
  height: 20px;
  z-index: 2 !important;
}

.grid-stack >>> .ui-resizable-e {
  z-index: 1 !important;
  right: 10px !important;
  top: 20px !important;
  bottom: 20px !important;
}

.grid-stack >>> .ui-resizable-w {
  z-index: 1 !important;
  left: 10px !important;
  top: 20px !important;
  bottom: 20px !important;
}

.grid-stack >>> .ui-resizable-n {
  z-index: 1 !important;
  left: 20px !important;
  right: 20px !important;
  top: 10px !important;
}

.grid-stack >>> .ui-resizable-s {
  z-index: 1 !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 10px !important;
}

div >>> .grid-stack-item-removing .grid-stack-item-content {
  opacity: 0.5 !important;
  border: 2px solid rgba(255, 0, 0, 0.5);
  border-radius: 12px;
}

div >>> .ui-draggable-dragging .grid-stack-item-content,
div >>> .ui-resizable-resizing .grid-stack-item-content {
  box-shadow: none !important;
}

/* animate new box */
.grid-stack >>> .grid-stack-item:not(.grid-stack-placeholder) {
  -webkit-animation: slide-in-fwd-center 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  animation: slide-in-fwd-center 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

/* ----------------------------------------------
 * Generated by Animista on 2021-12-17 18:18:5
 * Licensed under FreeBSD License.
 * See http://animista.net/license for more info. 
 * w: http://animista.net, t: @cssanimista
 * ---------------------------------------------- */

/**
 * ----------------------------------------
 * animation slide-in-fwd-center
 * ----------------------------------------
 */
@-webkit-keyframes slide-in-fwd-center {
  0% {
    -webkit-transform: translateZ(-1400px);
    transform: translateZ(-1400px);
    opacity: 0;
  }
  100% {
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    opacity: 1;
  }
}
@keyframes slide-in-fwd-center {
  0% {
    -webkit-transform: translateZ(-1400px);
    transform: translateZ(-1400px);
    opacity: 0;
  }
  100% {
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    opacity: 1;
  }
}
</style>
