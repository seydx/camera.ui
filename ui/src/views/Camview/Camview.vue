<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.camview-container.m-safe(v-else)
  .cameras-dropdown
    v-menu.tw-z-30(v-if="checkLevel('settings:edit')" v-model="showCardsMenu" transition="slide-y-transition" min-width="200px" :close-on-content-click="false" offset-y bottom left nudge-top="-15" content-class="light-shadow")
      template(v-slot:activator="{ on, attrs }")
        v-btn.text-muted.tw-mr-1(fab elevation="1" height="38px" width="38px" v-bind="attrs" v-on="on" color="rgba(0, 0, 0, 0.5)" retain-focus-on-click)
          v-icon {{ icons['mdiCog'] }}

      v-card.light-shadow.card-border.dropdown-content(max-width="360px")
        .tw-flex.tw-justify-between.tw-items-center.tw-py-3.tw-px-5.dropdown-title
          v-card-subtitle.tw-p-0.tw-m-0.tw-text-sm.tw-font-medium {{ $t('favourites') }}
        v-divider
        v-card-text.tw-py-3.tw-px-5.text-center
          v-virtual-scroll(v-if="allCameras.length" :items="allCameras" item-height="64" height="192" bench="10")
            template(v-slot:default="{ item }")
              v-list.tw-p-0
                v-list-item.dropdown-content.tw-p-0(inactive)
                  v-list-item-content
                    v-list-item-title
                      .text-left.tw-text-sm.tw-font-medium {{ item.name }}
                  v-list-item-action.tw-pr-4
                    v-switch.tw-m-0(v-model="item.favourite" @change="updateLayout(item.name, item.favourite)" color="rgba(var(--cui-primary-700-rgb))")
                v-divider

          span.text-default(v-else) {{ $t('no_cameras') }}
  #container.grid-stack
    .grid-stack-item(v-for="(camera, index) in cameras" :gs-id="index" :key="camera.name")
      .grid-stack-item-content
        VideoCard(:ref="camera.name" :camera="camera" title titlePosition="inner-top" status :stream="camera.live" :refreshSnapshot="!camera.live" :notifications="Boolean(camera.lastNotification)" blank)
    .tw-flex.tw-justify-center.tw-items-center.tw-h-full.tw-w-full(v-if="!cameras.length")
      span.text-muted {{ $t('no_cameras') }} :(

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
import LightBox from 'vue-it-bigger';
import 'vue-it-bigger/dist/vue-it-bigger.min.css';
import 'gridstack/dist/gridstack.min.css';
import { GridStack } from 'gridstack';
import 'gridstack/dist/jq/gridstack-dd-jqueryui';
import { mdiCog } from '@mdi/js';

import { getCameras, getCameraSettings } from '@/api/cameras.api';
import { getNotifications } from '@/api/notifications.api';
import { getSetting, changeSetting } from '@/api/settings.api';

import VideoCard from '@/components/camera-card.vue';

import socket from '@/mixins/socket';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Camview',

  components: {
    LightBox,
    VideoCard,
  },

  mixins: [socket],

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  data: () => ({
    allCameras: [],
    cameras: [],
    icons: {
      mdiCog,
    },
    loading: false,
    showCardsMenu: false,
  }),

  computed: {
    camviewLayout() {
      return this.$store.state.camview?.layout;
    },
  },

  async mounted() {
    try {
      const cameras = await getCameras();

      for (const camera of cameras.data.result) {
        const settings = await getCameraSettings(camera.name);
        camera.settings = settings.data;
        camera.favourite = camera.settings.camview.favourite;
        camera.live = camera.settings.camview.live || false;
        camera.refreshTimer = camera.settings.camview.refreshTimer || 60;
        const lastNotification = await getNotifications(`?cameras=${camera.name}&pageSize=5`);
        camera.lastNotification = lastNotification.data.result.length > 0 ? lastNotification.data.result[0] : false;
      }

      this.allCameras = cameras.data.result;
      this.cameras = cameras.data.result.filter((camera) => camera.favourite);

      this.loading = false;

      await timeout(100);

      this.grid = GridStack.init({
        alwaysShowResizeHandle: this.isMobile(),
        disableOneColumnMode: true,
        animate: true,
        margin: 2,
        row: 12,
        float: true,
        column: 12,
        resizable: {
          autoHide: !this.isMobile(),
          handles: 'all',
        },
        cellHeight: this.windowHeight() / 12,
      });

      const count = this.items().length.toString();

      if (this.camviewLayout[count]?.length > 0 && this.camviewLayout[count]?.length === this.items().length) {
        this.restoreFromStorage(count);
      } else {
        this.getLayout(true);
      }

      this.grid.on('dragstop resizestop', this.saveToStorage);

      document.addEventListener('keydown', this.logKey);
      document.addEventListener('fullscreenchange', this.fullscreenHandler);
      window.addEventListener('resize', this.resizeHandler);
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    document.removeEventListener('keydown', this.logKey);
    document.removeEventListener('fullscreenchange', this.fullscreenHandler);
    window.removeEventListener('resize', this.resizeHandler);
  },

  methods: {
    closeFullscreen() {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        /* Firefox */
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        /* Chrome, Safari and Opera */
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        /* IE/Edge */
        document.msExitFullscreen();
      }

      this.fullscreen = false;
    },
    fullscreenHandler() {
      if (document.fullscreenElement) {
        console.log('Entered fullscreen mode.');
        this.fullscreen = true;
      } else {
        console.log('Leaving fullscreen mode.');
        this.fullscreen = false;
      }
    },
    getLayout(update) {
      let nodes = [];

      let index_ = 0;
      let x = 0;
      let y = 0;
      let w = this.items().length < 7 ? 6 : 4;
      let h =
        12 /
        Math.round(
          (this.items().length % 2 === 0 ? this.items().length : this.items().length + 1) /
            (this.items().length < 7 ? 2 : 3)
        );

      for (const [index, element] of this.items().entries()) {
        const beforeElement = this.items()[index ? index - 1 : index];
        let lastX = Number.parseInt(beforeElement.getAttribute('gs-x'));

        x = this.items().length < 7 ? (index && !lastX ? 6 : 0) : index && !lastX ? 4 : lastX == 4 ? 8 : 0;

        if (this.items().length < 7 && index % 2 == 0) {
          y = index_ * h;
          index_++;
        }

        if (this.items().length >= 7 && index % 3 == 0) {
          y = index_ * h;
          index_++;
        }

        if (this.items().length === 1) {
          x = 0;
          y = 0;
          w = 12;
          h = 12;
        }

        if (this.items().length === 2) {
          x = 0;
          y = index * 6;
          w = 12;
          h = 6;
        }

        nodes.push({
          index: index,
          el: element,
          x: x,
          y: y,
          w: w,
          h: h,
        });

        if (update) {
          this.grid.update(element, {
            x: x,
            y: y,
            w: w,
            h: h,
          });
        }
      }

      return nodes;
    },
    isMobile() {
      return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.platform) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      );
    },
    items() {
      return document.querySelectorAll('.grid-stack-item');
    },
    logKey(event) {
      if (event.key === 'F11' || event.keyCode === 122) {
        event.preventDefault();
        !this.fullscreen ? this.openFullscreen() : this.closeFullscreen();
      } else if ((event.key === 'Escape' || event.keyCode === 27) && this.fullscreen) {
        event.preventDefault();
        this.closeFullscreen();
      }
    },
    openFullscreen() {
      const elem = document.querySelector('html');

      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        /* Firefox */
        elem.mozRequestFullScreen();
      } else if (elem.webkitRequestFullscreen) {
        /* Chrome, Safari and Opera */
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        /* IE/Edge */
        elem.msRequestFullscreen();
      }

      this.fullscreen = true;
    },
    refreshLayout(nodes) {
      let index_ = 0;
      let x = 0;
      let y = 0;
      let w = nodes.length < 7 ? 6 : 4;
      let h = 12 / Math.round((nodes.length % 2 === 0 ? nodes.length : nodes.length + 1) / (nodes.length < 7 ? 2 : 3));

      for (const [index, node] of nodes.entries()) {
        const beforeElement = nodes[index ? index - 1 : index].el;
        let lastX = Number.parseInt(beforeElement.getAttribute('gs-x'));

        x = nodes.length < 7 ? (index && !lastX ? 6 : 0) : index && !lastX ? 4 : lastX == 4 ? 8 : 0;

        if (nodes.length < 7 && index % 2 == 0) {
          y = index_ * h;
          index_++;
        }

        if (nodes.length >= 7 && index % 3 == 0) {
          y = index_ * h;
          index_++;
        }

        if (nodes.length === 1) {
          x = 0;
          y = 0;
          w = 12;
          h = 12;
        }

        if (nodes.length === 2) {
          x = 0;
          y = index * 6;
          w = 12;
          h = 6;
        }

        const nodePosition = {
          id: node.el.getAttribute('gs-id'),
          x: x,
          y: y,
          w: w,
          h: h,
        };

        this.grid.addWidget(node.el, nodePosition);
      }
    },
    resizeHandler() {
      if (this.grid) {
        this.grid.cellHeight(this.windowHeight() / 12, true);
      }
    },
    restoreFromStorage(count, items, add) {
      items = items || this.items();
      const layout = this.camviewLayout[count];
      //console.log(`Loading layout: ${JSON.stringify(layout)}`);
      //this.grid.load(layout, true);
      //this.grid.load(layout, true); //TODO - .load() not updating (y) with gridstack v4.x
      for (const element of items) {
        for (const pos of layout) {
          const id = element.getAttribute('gs-id');
          if (id === pos.id) {
            if (add) {
              this.grid.addWidget(element, pos);
            } else {
              this.grid.update(element, pos);
            }
          }
        }
      }
    },
    saveToStorage() {
      const itemLayout = {};
      itemLayout[this.items().length] = this.grid.save();

      for (const element of itemLayout[this.items().length]) {
        delete element.content;
      }

      console.log(`Storing layout: ${JSON.stringify(itemLayout, null, 2)}`);
      this.$store.dispatch('camview/updateElements', itemLayout);
    },
    async updateLayout(cameraName, state) {
      try {
        const camera = this.allCameras.find((camera) => camera && camera.name === cameraName);
        const cameraSettings = await getSetting('cameras');

        for (const cameraSetting of cameraSettings.data) {
          if (cameraSetting.name === camera.name) {
            cameraSetting.camview.favourite = state;
          }
        }

        await changeSetting('cameras', cameraSettings.data);

        if (state) {
          this.cameras.push(camera);
        } else {
          this.cameras = this.cameras.filter((camera) => camera && camera.name !== cameraName);
        }

        await timeout(10);

        const nodes = this.getLayout();
        this.grid.removeAll();

        const count = nodes.length.toString();

        if (this.camviewLayout[count]?.length > 0 && this.camviewLayout[count]?.length === nodes.length) {
          const items = nodes.map((node) => node.el);
          this.restoreFromStorage(count, items, true);
        } else {
          this.refreshLayout(nodes);
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    windowHeight() {
      return document.getElementById('container')?.offsetHeight;
    },
  },
};
</script>

<style scoped>
.camview-container {
  overflow: hidden;
  height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  min-height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  max-height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
}

.grid-stack {
  height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  min-height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  max-height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
}

.grid-stack-item-content {
  background: #000;
}

.grid-stack-item-title {
  position: absolute;
  top: 1rem;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 20px;
  font-size: 0.875rem;
  color: #fff;
  cursor: pointer;
  font-weight: 500;
}

.cameras-dropdown {
  position: absolute;
  top: 1rem !important;
  right: calc(env(safe-area-inset-left, 0px) + 1rem) !important;
  z-index: 1;
}
</style>
