<template lang="pug">
div(
  :class="cardClass",
  :style="fullscreen ? 'transform: unset !important' : ''"
)
  div.toggleArea(
    :class="headerPosition === 'top' ? 'dif-wrapper-top' : 'dif-wrapper-bottom'"
    :style="fullsize ? 'top: 0!important; bottom: 0!important' : ''"
  )
    b-icon.refreshOverlay(
      icon="arrow-clockwise",
      :class="fullscreen ? 'refreshOverlay-on' : ''"
      v-if="showRefreshIndicator && (camera.live || onlyStream)",
      @click="$emit('refreshStream', { camera: camera.name })"
    )
    b-icon.fullsizeOverlay(
      :icon="fullscreen ? 'arrows-angle-contract' : 'arrows-angle-expand'",
      :class="fullscreen ? 'fullsizeOverlay-on' : ''"
      v-if="showFullsizeIndicator",
      @click="handleFullscreen(camera)"
    )
    b-link.notOverlay.text-center(
      v-if="notificationOverlay && camera.lastNotification", 
      :data-stream-notification="camera.name"
      :class="fullscreen ? 'notOverlay-on' : ''"
      @click="index = 0"
    ) {{ $t("last_notification") + ": " }}
      br 
      span.notOverlayTime {{ camera.lastNotification.time }}
    router-link.nameOverlay.mt-save(
      v-if="nameOverlay",
      :class="fullscreen ? 'nameOverlay-on' : ''"
      :to='\'/cameras/\' + camera.name'
    ) {{ camera.name }}
    .updateOverlay(
      v-if="camera.live === false", 
      :data-stream-timer="camera.name"
      :class="fullscreen ? 'updateOverlay-on' : ''"
    )
    .lds-ring(v-if="showSpinner", 
      :data-stream-spinner="camera.name"
      ref="lds_spinner"
    )
      div
      div
      div
      div
    svg.b-icon.bi.bi-camera-video-off-fill.text-white.position-absolute-center.offlineOverlay(
      :data-stream-offline="camera.name"
      ref="offline_icon"
      viewBox='0 0 16 16' 
      width='50px' 
      height='50px' 
      focusable='false' 
      role='img' 
      aria-label='camera video off fill' 
      xmlns='http://www.w3.org/2000/svg' 
      fill='currentColor'
    )
      g
        path(fill-rule='evenodd' d='M10.961 12.365a1.99 1.99 0 0 0 .522-1.103l3.11 1.382A1 1 0 0 0 16 11.731V4.269a1 1 0 0 0-1.406-.913l-3.111 1.382A2 2 0 0 0 9.5 3H4.272l6.69 9.365zm-10.114-9A2.001 2.001 0 0 0 0 5v6a2 2 0 0 0 2 2h5.728L.847 3.366zm9.746 11.925l-10-14 .814-.58 10 14-.814.58z')
  b-card-body(v-if="headerPosition === 'top' && !fullsize")
    b-card-title.float-left {{ camera.name }}
    b-icon.float-right.card-icon-status.ml-2(v-if="statusIndicator", icon="circle-fill", aria-hidden="true", :data-stream-status="camera.name", variant="danger")
    b-icon.float-right.text-color-primary.card-icon(v-if="notificationBell && camera.lastNotification", icon="bell-fill", aria-hidden="true", :id='\'popover-target-\' + camera.name.replace(/\s/g,"")')
    b-popover(v-if="notificationBell && camera.lastNotification", :target='\'popover-target-\' + camera.name.replace(/\s/g,"")' triggers="hover" placement="top") 
      b {{ $t("last_notification") + ": " }}
      br
      span {{ camera.lastNotification.time }}
  router-link.position-relative.bg-dark(
    v-if="linkToCamera", 
    :to='\'/cameras/\' + camera.name', 
    :data-stream-wrapper="camera.name"
    :class="!fullsize ? headerPosition === 'top' ? 'card-img-bottom' : 'card-img-top' : ''",
    :aria-label="camera.name"
  )
    canvas.canvas.card-img.img-overlay(
      :data-stream-box="camera.name",
      :class="!fullsize ? headerPosition === 'top' ? 'card-img-bottom' : 'card-img-top' : ''",
    )
  div.h-100(
    v-else
    :data-stream-wrapper="camera.name",
    :class="!fullsize ? headerPosition === 'top' ? 'card-img-bottom' : 'card-img-top' : ''",
  )
    canvas.canvas.card-img.img-overlay.toggleArea(
      :data-stream-box="camera.name",
      :class="!fullsize ? headerPosition === 'top' ? 'card-img-bottom' : 'card-img-top' : ''",
      :style="onlyStream ? 'height:' + aspectRatioHeight + 'px' : ''"
    )
  b-card-body(v-if="headerPosition === 'bottom' && !fullsize")
    b-card-title.float-left {{ camera.name }}
    b-icon.float-right.card-icon-status.ml-2(v-if="statusIndicator", icon="circle-fill", aria-hidden="true", :data-stream-status="camera.name", variant="danger")
    b-icon.float-right.text-color-primary.card-icon(v-if="notificationBell && camera.lastNotification", icon="bell-fill", aria-hidden="true", :id='\'popover-target-\' + camera.name.replace(/\s/g,"")')
    b-popover(v-if="notificationBell && camera.lastNotification", :target='\'popover-target-\' + camera.name.replace(/\s/g,"")' triggers="hover" placement="top") 
      b {{ $t("last_notification") + ": " }}
      br
      span {{ camera.lastNotification.time }}
  #cameraFsBg(v-if="showFullsizeIndicator")
  CoolLightBox(
    v-if="notificationOverlay && camera.lastNotification"
    :items="images" 
    :index="index"
    @close="index = null"
    :closeOnClickOutsideMobile="true"
    :useZoomBar="true"
  )
</template>

<script>
import CoolLightBox from 'vue-cool-lightbox';
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';

import {
  BIcon,
  BIconArrowsAngleExpand,
  BIconArrowsAngleContract,
  BIconArrowClockwise,
  BIconBellFill,
  BIconCircleFill,
} from 'bootstrap-vue';

import JSMpeg from 'jsmpeg-fast-player';
import JSMpegWritableSource from '@/common/jsmpeg-source.js';

import { getCameraSnapshot, getCameraStatus } from '@/api/cameras.api';

export default {
  name: 'VideoCard',
  components: {
    BIcon,
    BIconArrowsAngleExpand,
    BIconArrowsAngleContract,
    BIconArrowClockwise,
    BIconBellFill,
    BIconCircleFill,
    CoolLightBox,
  },
  props: {
    camera: {
      type: Object,
      required: true,
    },
    cardClass: {
      type: String,
      default: '',
    },
    headerPosition: {
      type: String,
      default: 'top',
    },
    fullsize: {
      type: Boolean,
      default: false,
    },
    linkToCamera: {
      type: Boolean,
      default: false,
    },
    nameOverlay: {
      type: Boolean,
      default: false,
    },
    notificationOverlay: {
      type: Boolean,
      default: false,
    },
    notificationBell: {
      type: Boolean,
      default: false,
    },
    onlySnapshot: {
      type: Boolean,
      default: false,
    },
    onlyStream: {
      type: Boolean,
      default: false,
    },
    showRefreshIndicator: {
      type: Boolean,
      default: false,
    },
    showFullsizeIndicator: {
      type: Boolean,
      default: false,
    },
    showSpinner: {
      type: Boolean,
      default: false,
    },
    statusIndicator: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      images: [],
      index: null,
      fullscreen: false,
      player: null,
      stopped: false,
      timer: null,
      timerCounter: 0,
      ldsVisible: null,
      offVisible: null,
      aspectRatioHeight: 0,
    };
  },
  mounted() {
    window.addEventListener('resize', this.aspectRatioHandler);

    this.stopped = false;

    const containerWidth = window.innerWidth <= 1100 ? window.innerWidth : 1100;
    this.aspectRatioHeight = Math.round((containerWidth / 16) * 9);

    if (this.camera.lastNotification) {
      const notification = this.camera.lastNotification;
      this.images = [
        {
          title: `${notification.camera} - ${notification.time}`,
          src: `/files/${notification.fileName}`,
          thumb:
            notification.recordType === 'Video'
              ? `/files/${notification.name}@2.jpeg`
              : `/files/${notification.fileName}`,
        },
      ];
    }

    if (this.checkLevel('cameras:access')) {
      if (this.camera.live || this.onlyStream) {
        this.startLivestream();
      } else {
        this.startSnapshot();
      }
    }
  },
  beforeDestroy() {
    this.stopped = true;
    this.stopLivestream();
    this.stopSnapshot();

    window.removeEventListener('resize', this.aspectRatioHandler);
  },
  methods: {
    aspectRatioHandler() {
      const containerWidth = window.innerWidth <= 1100 ? window.innerWidth : 1100;
      const streamBox = document.getElementById('streamBox');

      this.aspectRatioHeight = Math.round(
        ((streamBox
          ? streamBox.offsetWidth > 800
            ? streamBox.offsetWidth - 100
            : streamBox.offsetWidth
          : containerWidth) /
          16) *
          9
      );
    },
    handleFullscreen(camera) {
      const fullscreenBg = document.querySelector('#cameraFsBg');
      const videoCard = document.querySelector(`[data-stream-box="${camera.name}"]`);
      this.fullscreen = videoCard.classList.contains('camera-fs');

      const ldsSpinnerVisible = this.$refs.lds_spinner.classList.contains('d-block');
      const offlineIconVisible = this.$refs.offline_icon.classList.contains('d-block');

      if (this.fullscreen) {
        this.fullscreen = false;
        videoCard.classList.remove('camera-fs');
        fullscreenBg.classList.remove('camera-fs-bg');
        videoCard.classList.add('img-overlay');

        this.$refs.offline_icon.classList.remove('offlineOverlay-on');
        this.$refs.lds_spinner.classList.remove('lds-ring-on');
      } else {
        this.fullscreen = true;
        videoCard.classList.add('camera-fs');
        fullscreenBg.classList.add('camera-fs-bg');
        videoCard.classList.remove('img-overlay');

        this.$refs.offline_icon.classList.add('offlineOverlay-on');
        this.$refs.lds_spinner.classList.add('lds-ring-on');
      }

      if (ldsSpinnerVisible) {
        this.$refs.lds_spinner.classList.remove('d-none');
        this.$refs.lds_spinner.classList.add('d-block');
      } else {
        this.$refs.lds_spinner.classList.remove('d-block');
        this.$refs.lds_spinner.classList.add('d-none');
      }

      if (offlineIconVisible) {
        this.$refs.offline_icon.classList.remove('d-none');
        this.$refs.offline_icon.classList.add('d-block');
      } else {
        this.$refs.offline_icon.classList.remove('d-block');
        this.$refs.offline_icon.classList.add('d-none');
      }
    },
    setSnapshotTimer() {
      let timerIndicator = document.querySelector(`[data-stream-timer="${this.camera.name}"]`);

      if (timerIndicator) {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }

        this.timerCounter = 0;
        this.timer = setInterval(() => {
          this.timerCounter++;
          timerIndicator.textContent = this.timerCounter + 's';
        }, 1000);
      }
    },
    async startSnapshot() {
      this.showLoading();

      if (!this.stopped) {
        const status = await getCameraStatus(this.camera.name, this.camera.settings.pingTimeout);

        if (status.data.status === 'ONLINE') {
          const snapshot = await getCameraSnapshot(this.camera.name, '?buffer=true');

          this.showOnline();

          const img = document.createElement('img');
          let imgBuffer = 'data:image/png;base64,';

          if (!snapshot.data || (snapshot.data && snapshot.data === '')) {
            img.classList.add('object-fit-none');
            imgBuffer = require('../assets/img/no_img_white.png');
          } else {
            imgBuffer += snapshot.data;
          }

          img.classList.add('toggleArea');
          img.setAttribute('src', imgBuffer);
          img.setAttribute('alt', 'Snapshot');
          img.dataset.streamBox = this.camera.name;

          const target = document.querySelector(`[data-stream-box="${this.camera.name}"]`);

          if (target) {
            for (const value of target.classList) img.classList.add(value);
            target.replaceWith(img);
          }
        } else {
          this.showOffline();
        }

        if (!this.onlySnapshot) {
          this.setSnapshotTimer();

          if (this.snapshotTimeout) {
            clearTimeout(this.snapshotTimeout);
            this.snapshotTimeout = null;
          }

          this.snapshotTimeout = setTimeout(async () => {
            this.startSnapshot();
          }, this.camera.refreshTimer * 1000);
        }
      }
    },
    stopSnapshot() {
      if (this.snapshotTimeout) {
        clearTimeout(this.snapshotTimeout);
        this.snapshotTimeout = null;
      }
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    },
    async startLivestream() {
      this.showLoading();

      if (!this.stopped) {
        const status = await getCameraStatus(this.camera.name, this.camera.settings.pingTimeout);

        if (status.data.status === 'ONLINE') {
          this.player = new JSMpeg.Player(null, {
            source: JSMpegWritableSource,
            canvas: document.querySelector(`[data-stream-box="${this.camera.name}"]`),
            audio: true,
            disableWebAssembly: true,
            pauseWhenHidden: false,
            videoBufferSize: 1024 * 1024,
            onSourcePaused: () => this.showLoading(),
            onSourceEstablished: () => this.showOnline(),
          });

          this.player.volume = 1;
          this.player.name = this.camera.name;
        } else {
          this.showOffline();
        }

        this.$socket.client.emit('join_stream', {
          feed: this.camera.name,
        });
      }
    },
    stopLivestream() {
      if (this.player) {
        this.player.destroy();
      }

      this.$socket.client.emit('leave_stream', {
        feed: this.camera.name,
      });
    },
    showLoading() {
      let spinner = document.querySelector(`[data-stream-spinner="${this.camera.name}"]`);
      let offlineIcon = document.querySelector(`[data-stream-offline="${this.camera.name}"]`);

      if (offlineIcon) {
        offlineIcon.classList.remove('d-block');
        offlineIcon.classList.add('d-none');
      }

      if (spinner) {
        spinner.classList.remove('d-none');
        spinner.classList.add('d-block');
      }
    },
    showOnline() {
      let spinner = document.querySelector(`[data-stream-spinner="${this.camera.name}"]`);
      let statusIndicator = document.querySelector(`[data-stream-status="${this.camera.name}"]`);
      let offlineIcon = document.querySelector(`[data-stream-offline="${this.camera.name}"]`);

      if (offlineIcon) {
        offlineIcon.classList.remove('d-block');
        offlineIcon.classList.add('d-none');
      }

      if (spinner) {
        spinner.classList.remove('d-block');
        spinner.classList.add('d-none');
      }

      if (statusIndicator) {
        statusIndicator.classList.remove('text-danger');
        statusIndicator.classList.add('text-success');
      }
    },
    showOffline() {
      this.$toast.error(`${this.camera.name}: ${this.$t('offline')}`);

      let spinner = document.querySelector(`[data-stream-spinner="${this.camera.name}"]`);
      let statusIndicator = document.querySelector(`[data-stream-status="${this.camera.name}"]`);
      let offlineIcon = document.querySelector(`[data-stream-offline="${this.camera.name}"]`);

      if (statusIndicator) {
        statusIndicator.classList.remove('text-success');
        statusIndicator.classList.add('text-danger');
      }

      if (spinner) {
        spinner.classList.remove('d-block');
        spinner.classList.add('d-none');
      }

      if (offlineIcon) {
        offlineIcon.classList.remove('d-none');
        offlineIcon.classList.add('d-block');
      }

      if (!this.camera.live && !this.onlyStream) {
        const canvas = document.createElement('canvas');
        canvas.classList.add('toggleArea');
        canvas.dataset.streamBox = this.camera.name;

        const target = document.querySelector(`[data-stream-box="${this.camera.name}"]`);

        if (target) {
          for (const value of target.classList) {
            canvas.classList.add(value);
          }

          target.replaceWith(canvas);
        }
      }
    },
    pauseStream() {
      if (this.player) {
        this.player.source.pause(true);
      }
    },
    writeStream(buffer) {
      if (this.player) {
        this.player.source.write(buffer);
      }
    },
  },
};
</script>

<style scoped>
.dif-wrapper-top {
  position: absolute;
  top: 3rem;
  left: 0;
  right: 0;
  bottom: 0;
}

.dif-wrapper-bottom {
  position: absolute;
  bottom: 3rem;
  left: 0;
  right: 0;
  top: 0;
}

.card {
  font-family: Open Sans, sans-serif;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  word-wrap: break-word;
  border-radius: 0.5rem;
  background-color: var(--secondary-bg-color);
  background-clip: border-box;
  border: 1px solid var(--secondary-bg-color);
  box-shadow: 0 0 2rem 0 rgb(136 152 170 / 30%);
  margin-bottom: 30px;
  -webkit-box-shadow: rgba(0, 0, 0, 0.68) 0px 17px 28px -21px;
  box-shadow: rgba(0, 0, 0, 0.68) 0px 17px 28px -21px;
}

.card-body {
  padding: 0.8rem 1rem;
}

.card-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.card-img-bottom,
a >>> .card-img-bottom,
div >>> .card-img-bottom {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: calc(0.5rem - 1px);
  border-bottom-right-radius: calc(0.5rem - 1px);
}

.card-img-top,
a >>> .card-img-top,
div >>> .card-img-top {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: calc(0.5rem - 1px);
  border-top-right-radius: calc(0.5rem - 1px);
}

.card-icon {
  font-size: 12px;
  cursor: pointer;
  margin-top: 3px;
}

.card-icon-status {
  font-size: 10px;
  margin-top: 3px;
}

.loading-spinner {
  color: var(--primary-color);
}

.canvas {
  background: #000000;
  margin: 0;
  padding: 0;
  display: block;
}

.nameOverlay {
  position: absolute;
  left: 50%;
  -webkit-transform: translateX(-50%);
  -ms-transform: translateX(-50%);
  transform: translateX(-50%);
  top: 5px;
  display: block;
  background: rgb(0 0 0 / 30%);
  padding: 5px;
  border-radius: 5px;
  color: #ffffff;
  font-size: 10px;
  z-index: 1;
}

.nameOverlay:hover {
  text-decoration: none !important;
}

.nameOverlay-on {
  position: fixed;
  top: calc(env(safe-area-inset-bottom, -17px) + 17px);
  z-index: 201;
}

.offlineOverlay {
  z-index: 1;
}

.offlineOverlay-on {
  position: fixed;
  z-index: 201;
}

.updateOverlay {
  z-index: 20;
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: block;
  background: rgb(0 0 0 / 30%);
  padding: 5px;
  border-radius: 5px;
  color: #ffffff;
  font-size: 10px;
  z-index: 1;
}

.updateOverlay-on {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom, -17px) + 17px);
  right: calc(env(safe-area-inset-right, -17px) + 17px);
  z-index: 201;
}

.notOverlay {
  position: absolute;
  left: 50%;
  -webkit-transform: translateX(-50%);
  -ms-transform: translateX(-50%);
  transform: translateX(-50%);
  bottom: 20px;
  display: block;
  background: rgb(0 0 0 / 40%);
  padding: 5px;
  border-radius: 5px;
  color: #ffffff;
  font-size: 10px;
  z-index: 1;
}

.notOverlayTime {
  color: var(--fourht-bg-color) !important;
}

.notOverlay-on {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom, -17px) + 17px);
  z-index: 201;
}

.notOverlay:hover {
  text-decoration: none !important;
}

.notOverlay span,
.notOverlay a,
.notOverlay a:hover {
  color: rgba(255, 255, 255, 0.5);
}

.refreshOverlay {
  position: absolute;
  left: 10px;
  background: rgb(255 255 255 / 25%);
  padding: 3px;
  border-radius: 4px;
  z-index: 1;
  top: 5px;
  cursor: pointer;
  transition: 0.3s all;
  font-size: 1.3rem;
}

.refreshOverlay-on {
  z-index: 202;
  top: calc(env(safe-area-inset-top, -17px) + 17px);
  left: calc(env(safe-area-inset-left, -17px) + 17px);
  position: fixed;
}

.refreshOverlay:hover {
  background: rgb(255 255 255 / 45%);
}

.fullsizeOverlay {
  position: absolute;
  right: 10px;
  background: rgb(255 255 255 / 25%);
  padding: 3px;
  border-radius: 4px;
  z-index: 1;
  top: 5px;
  cursor: pointer;
  transition: 0.3s all;
  font-size: 1.3rem;
}

.fullsizeOverlay-on {
  z-index: 202;
  top: calc(env(safe-area-inset-top, -17px) + 17px);
  right: calc(env(safe-area-inset-right, -17px) + 17px);
  position: fixed;
}

.fullsizeOverlay:hover {
  background: rgb(255 255 255 / 45%);
}

.fix-top-50 {
  top: 50px !important;
}

.refresh-icon {
  cursor: pointer;
  color: var(--fourth-bg-color);
}

.camera-fs,
div >>> .camera-fs {
  position: fixed;
  z-index: 200;
  top: 50%;
  border-radius: 0 !important;
  right: 0;
  bottom: 0;
  border: none !important;
  transition: all 0.6s;
  max-height: 90% !important;
  max-width: 90% !important;
  left: 50%;
  transform: translate(-50%, -50%);
}

.camera-fs-bg {
  position: fixed !important;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 199;
  background: #000000;
  transition: all 0.6s;
  bottom: 0;
}

.lds-ring {
  background: rgb(0 0 0 / 51%);
  border-radius: 30px;
  z-index: 1;
}

.lds-ring-on {
  z-index: 201;
  position: fixed;
}

/* Equal-height card images, cf. https://stackoverflow.com/a/47698201/1375163*/
a >>> .img-overlay {
  /*height: 11vw;*/
  object-fit: cover;
  height: 50vw;
}
/* Small devices (landscape phones, 576px and up) */
@media (min-width: 576px) {
  a >>> .img-overlay {
    height: 35vw;
  }
}
/* Medium devices (tablets, 768px and up) */
@media (min-width: 768px) {
  a >>> .img-overlay {
    height: 18vw;
  }
}
/* Large devices (desktops, 992px and up) */
@media (min-width: 992px) {
  a >>> .img-overlay {
    height: 15vw;
  }
}
/* Extra large devices (large desktops, 1200px and up) */
@media (min-width: 1200px) {
  a >>> .img-overlay {
    height: 13vw;
    max-height: 160px;
  }
}
</style>
