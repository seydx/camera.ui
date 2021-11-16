<template lang="pug">
div
  main.inner-container.w-100.h-100vh-calc.pt-save.footer-offset.toggleArea
    .container.pt-3.d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
      b-spinner.text-color-primary
    .container.pt-3.toggleArea(v-else)
      draggable(v-model='cameras', ghost-class="ghost-box", @change="storeLayout", animation=200, delay="200" delay-on-touch-only="true")
        transition-group(type="transition", class="row justify-content-center")
          .col-lg-4.col-md-6.col-12.my-1.toggleArea(v-for="(camera, i) in cameras", :key="camera.name")
            VideoCard(
              :ref="camera.name"
              :key="camera.name",
              :camera="camera",
              cardClass="card"
              headerPosition="top",
              :linkToCamera="true",
              :notificationOverlay="true",
              :showFullsizeIndicator="true",
              :showRefreshIndicator="true",
              :showSpinner="true",
              :statusIndicator="true"
              @refreshStream="refreshStreamProcess"
            )
      .mt-5.text-center(v-if="!cameras.length" data-aos="fade-up" data-aos-duration="1000")
        span(style="color: var(--secondary-font-color)") {{ $t('no_cameras') }} :(
  CoolLightBox(
    :items="notImages" 
    :index="notIndex"
    @close="closeHandler"
    :closeOnClickOutsideMobile="true"
    :useZoomBar="true",
    :zIndex=99999
  )
  ActionSheet(
    v-if="allCameras.length && checkLevel(['cameras:access', 'settings:cameras:access', 'settings:dashboard:access'])"
    :items="allCameras"
    state="favourite"
    @changeState="handleFavouriteCamera"
  )
</template>

<script>
import CoolLightBox from 'vue-cool-lightbox';
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';
import draggable from 'vuedraggable';

import { getCameras, getCameraSettings } from '@/api/cameras.api';
import { getNotifications } from '@/api/notifications.api';
import { getSetting, changeSetting } from '@/api/settings.api';
import ActionSheet from '@/components/actionsheet.vue';
import VideoCard from '@/components/video-card.vue';
import SocketMixin from '@/mixins/socket.mixin';

export default {
  name: 'Dashboard',
  components: {
    ActionSheet,
    CoolLightBox,
    draggable,
    VideoCard,
  },
  mixins: [SocketMixin],
  data() {
    return {
      allCameras: [],
      cameras: [],
      snapshotTimeout: null,
      loading: true,
    };
  },
  computed: {
    dashboardLayout() {
      return this.$store.state.dashboard.layout;
    },
  },
  async mounted() {
    try {
      if (this.checkLevel(['cameras:access', 'settings:dashboard:access'])) {
        const cameras = await getCameras();
        const dashboardSettings = await getSetting('dashboard');

        for (const camera of cameras.data.result) {
          const settings = await getCameraSettings(camera.name);
          camera.settings = settings.data;

          camera.favourite = camera.settings.dashboard.favourite;
          camera.live = camera.settings.dashboard.live || false;
          camera.refreshTimer = dashboardSettings.data.refreshTimer || 60;

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

        await this.updateLayout();
      } else {
        this.$toast.error(this.$t('no_access'));
      }
    } catch (err) {
      this.$toast.error(err.message);
    }

    this.loading = false;
  },
  methods: {
    async handleFavouriteCamera(cam) {
      try {
        const camera = this.allCameras.find((camera) => camera && camera.name === cam.name);

        const cameraSettings = await getSetting('cameras');
        for (const cameraSetting of cameraSettings.data) {
          if (cameraSetting.name === camera.name) {
            cameraSetting.dashboard.favourite = cam.state;
          }
        }

        await changeSetting('cameras', cameraSettings.data);

        if (cam.state) {
          this.cameras.push(camera);
        } else {
          this.cameras = this.cameras.filter((camera) => camera && camera.name !== cam.name);
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
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
    storeLayout() {
      const cameras = this.cameras
        .map((camera, index) => {
          return {
            index: index,
            name: camera.name,
          };
        })
        .filter((camera) => camera);
      this.$store.dispatch('dashboard/updateElements', cameras);
    },
    updateLayout() {
      for (const [index, camFromLayout] of this.dashboardLayout.entries()) {
        if (!this.cameras.some((camera) => camera && camera.name === camFromLayout.name))
          this.dashboardLayout.splice(index, 1);
      }

      for (const camera of this.cameras) {
        if (!this.dashboardLayout.some((camFromLayout) => camFromLayout && camFromLayout.name === camera.name))
          this.dashboardLayout.push({
            index: this.dashboardLayout.length > 0 ? this.dashboardLayout.length : 0,
            name: camera.name,
          });
      }

      const cameras = [...this.cameras];

      this.cameras = this.dashboardLayout
        .map((camera) => {
          let index = cameras.findIndex((cam) => cam.name === camera.name);
          return cameras[index];
        })
        .filter((camera) => camera);

      this.storeLayout();
    },
  },
};
</script>

<style scoped>
.inner-container {
  margin-top: 100px;
}

.camera-fade-enter-active {
  transition: all 0.4s ease;
}
.camera-fade-leave-active {
  transition: all 0.4s cubic-bezier(1, 0.5, 0.8, 1);
}
.camera-fade-enter,
.camera-fade-leave-to {
  transform: translateY(-30px);
  opacity: 0;
}

.ghost-box {
  opacity: 0;
}
</style>
