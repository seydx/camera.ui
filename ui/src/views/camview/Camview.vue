<template lang="pug">
.d-flex.flex-wrap.justify-content-center.align-content-center.h-100vh
  main.w-100.save-height.overflow-hidden
    #gridCont(v-if="loading")
      .grid-stack.h-100vh.d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize
        b-spinner.text-color-primary
    #gridCont.save-height.toggleArea(v-else)
      .grid-stack.toggleArea
        .grid-stack-item.toggleArea(v-for="(camera, index) in cameras" :gs-id="index" :key="camera.name")
          VideoCard(
            :ref="camera.name"
            :key="camera.name",
            :camera="camera",
            cardClass="grid-stack-item-content",
            :fullsize="true",
            :nameOverlay="true",
            :notificationOverlay="true",
            :showFullsizeIndicator="true",
            :showRefreshIndicator="true",
            :showStartStopIndicator="camera.live",
            :showVolumeIndicator="camera.settings.audio",
            :showSpinner="true",
            @refreshStream="refreshStreamProcess"
          )
  ActionSheet(
    v-if="checkLevel(['cameras:access', 'settings:cameras:access', 'settings:camview:access'])"
    :items="allCameras"
    state="favourite"
    :showLeftNavi="true"
    :leftNaviName="$t('back')"
    @leftNaviClick="goBack"
    :showMiddleNavi="!isMobile()"
    :middleNaviName="$t('fullscreen')"
    @middleNaviClick="showFullscreen"
    :showRightNavi="true"
    :rightNaviName="$t('signout')"
    @rightNaviClick="logOut"
    @changeState="handleFavouriteCamera"
  )
  CoolLightBox(
    :items="notImages" 
    :index="notIndex"
    @close="closeHandler"
    :closeOnClickOutsideMobile="true"
    :useZoomBar="true",
    :zIndex=99999
  )
</template>

<script>
import CoolLightBox from 'vue-cool-lightbox';
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';
import 'gridstack/dist/gridstack.min.css';
import { GridStack } from 'gridstack';
import 'gridstack/dist/jq/gridstack-dd-jqueryui';

import { getCameras, getCameraSettings } from '@/api/cameras.api';
import { getNotifications } from '@/api/notifications.api';
import { getSetting, changeSetting } from '@/api/settings.api';
import ActionSheet from '@/components/actionsheet.vue';
import VideoCard from '@/components/video-card.vue';

import SocketMixin from '@/mixins/socket.mixin';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Camview',
  components: {
    ActionSheet,
    CoolLightBox,
    VideoCard,
  },
  mixins: [SocketMixin],
  beforeRouteEnter(to, from, next) {
    next((vm) => {
      vm.prevRoute = from;
    });
  },
  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },
  data() {
    return {
      allCameras: [],
      cameras: [],
      fullscreen: false,
      grid: null,
      loading: true,
      prevRoute: null,
      serializedData: [],
    };
  },
  computed: {
    camviewLayout() {
      return this.$store.state.camview.layout;
    },
  },
  created() {
    const body = document.querySelector('body');
    const html = document.querySelector('html');
    body.classList.add('body-bg-dark');
    html.classList.add('body-bg-dark');
  },
  async mounted() {
    try {
      if (this.prevRoute && !this.prevRoute.name && !this.prevRoute.meta.name) {
        const backButton = document.querySelector('.back-button');
        if (backButton) {
          backButton.innerHTML = 'Dashboard';
        }
      }

      if (this.checkLevel(['cameras:access', 'settings:camview:access'])) {
        const cameras = await getCameras();
        const camviewSettings = await getSetting('camview');

        for (const camera of cameras.data.result) {
          const settings = await getCameraSettings(camera.name);
          camera.settings = settings.data;

          camera.favourite = camera.settings.camview.favourite;
          camera.live = camera.settings.camview.live || false;
          camera.refreshTimer = camviewSettings.data.refreshTimer || 60;

          const lastNotification = await getNotifications(`?cameras=${camera.name}&pageSize=5`);
          camera.lastNotification = lastNotification.data.result.length > 0 ? lastNotification.data.result[0] : false;

          if (camera.favourite && camera.live) {
            this.$socket.client.on(camera.name, (data) => {
              if (this.$refs[camera.name] && this.$refs[camera.name][0]) {
                this.$refs[camera.name][0].writeStream(data);
              }
            });
          }
        }

        this.allCameras = cameras.data.result;
        this.cameras = cameras.data.result.filter((camera) => camera.favourite);

        this.loading = false;

        await timeout(10);
        this.updateLayout();

        document.addEventListener('keydown', this.logKey);
        document.addEventListener('fullscreenchange', this.fullscreenHandler);
        window.addEventListener('resize', this.resizeHandler);
      } else {
        this.$toast.error(this.$t('no_access'));
      }
    } catch (err) {
      this.$toast.error(err.message);
    }

    this.loading = false;
  },
  beforeDestroy() {
    const body = document.querySelector('body');
    const html = document.querySelector('html');
    body.classList.remove('body-bg-dark');
    html.classList.remove('body-bg-dark');

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

      const fullscreenButton = document.querySelector('.middle-button');
      fullscreenButton.innerHTML = this.$t('fullscreen');

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
    async handleFavouriteCamera(cam) {
      try {
        const camera = this.allCameras.find((camera) => camera && camera.name === cam.name);
        const cameraSettings = await getSetting('cameras');
        for (const cameraSetting of cameraSettings.data) {
          if (cameraSetting.name === camera.name) {
            cameraSetting.camview.favourite = cam.state;
          }
        }

        await changeSetting('cameras', cameraSettings.data);

        if (cam.state) {
          this.cameras.push(camera);
        } else {
          this.cameras = this.cameras.filter((camera) => camera && camera.name !== cam.name);
        }

        await timeout(10); //need to wait a lil bit for grid to create all components

        const nodes = this.getLayout();
        this.grid.removeAll();

        const count = nodes.length.toString();

        if (
          this.camviewLayout[count] &&
          this.camviewLayout[count].length > 0 &&
          this.camviewLayout[count].length === nodes.length
        ) {
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
    goBack() {
      if (this.prevRoute && !this.prevRoute.name && !this.prevRoute.meta.name) {
        return this.$router.push('/dashboard');
      } else {
        this.$router.go(-1);
      }
    },
    isMobile() {
      let isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.platform) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return isMobile;
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
    async logOut() {
      await this.$store.dispatch('auth/logout');
      setTimeout(() => this.$router.push('/'), 200);
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

      const fullscreenButton = document.querySelector('.middle-button');
      fullscreenButton.innerHTML = this.$t('close');

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
    refreshStreamProcess(event) {
      if (this.$refs[event.camera] && this.$refs[event.camera][0]) {
        this.$refs[event.camera][0].pauseStream(true);
      }

      this.$socket.client.emit('refresh_stream', { feed: event.camera });
    },
    refreshStreamSocket(event) {
      if (this.$refs[event.camera] && this.$refs[event.camera][0]) {
        this.$refs[event.camera][0].pauseStream(true);
      }

      this.$socket.client.emit('rejoin_stream', { feed: event.camera });
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

      //console.log(`Storing layout: ${JSON.stringify(this.serializedData)}`);
      this.$store.dispatch('camview/updateElements', itemLayout);
    },
    showFullscreen() {
      if (this.fullscreen) {
        this.closeFullscreen();
      } else {
        this.openFullscreen();
      }
    },
    updateLayout() {
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

      this.grid.on('dragstop resizestop', () => {
        this.saveToStorage();
      });

      const count = this.items().length.toString();
      if (
        this.camviewLayout[count] &&
        this.camviewLayout[count].length > 0 &&
        this.camviewLayout[count].length === this.items().length
      ) {
        this.restoreFromStorage(count);
      } else {
        this.getLayout(true);
      }
    },
    windowHeight() {
      /*let windowHeight =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
          ? typeof window.outerHeight != 'undefined'
            ? Math.max(window.outerHeight, document.documentElement.clientHeight)
            : document.documentElement.clientHeight
          : document.documentElement.clientHeight;*/

      let mainFrameHeight = document.getElementById('gridCont').offsetHeight;
      return mainFrameHeight;
    },
    windowWidth() {
      let windowWidth = Math.max(document.documentElement.clientWidth, window.innerWidth);
      return windowWidth;
    },
  },
};
</script>

<style scoped>
.back-button {
  position: absolute;
  top: -120px;
  left: 0;
  z-index: 99;
  transition: 0.3s all;
}

.logout-button {
  position: absolute;
  top: -120px;
  right: 0;
  z-index: 99;
  transition: 0.3s all;
}

.btn-slide-animation {
  top: 0;
}

.grid-stack-item,
.grid-stack >>> .grid-stack-item {
  box-shadow: 0 0 1rem 0 rgb(0 0 0 / 30%);
}

.grid-stack-item-content,
.grid-stack >>> .grid-stack-item-content {
  background: #000000 !important;
  overflow: hidden !important;
}

.canvas,
.grid-stack-item-content >>> .canvas {
  border-top-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}

.img-overlay,
.grid-stack-item-content >>> .img-overlay {
  object-fit: fill !important;
  height: 100% !important;
  width: 100% !important;
  max-height: 100% !important;
}

.save-height {
  --safe-area-inset-top: env(safe-area-inset-top);
  --safe-area-inset-bottom: env(safe-area-inset-bottom);
  --safe-area-inset-left: env(safe-area-inset-left);
  --safe-area-inset-right: env(safe-area-inset-right);
  height: calc(100vh - var(--safe-area-inset-top) - var(--safe-area-inset-bottom));
  width: calc(100vw - var(--safe-area-inset-left) - var(--safe-area-inset-right));
  margin: 0 auto;
}
</style>
