<template lang="pug">
div
  BackToTop
  Navbar(:name="$t('cameras')")
  BreadcrumbFilter(
    :active="true",
    dataType="cameras",
    :showFilterCameras="true",
    :showFilterRooms="true",
    :showFilterStatus="true",
    @filter="filterCameras"
  )
  main.inner-container.w-100.h-100vh-calc-filter.pt-save.footer-offset
    .container.pt-3.d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
      b-spinner.text-color-primary
    .container.pt-3(v-else)
      .row
        .col-lg-4.col-md-6.col-12.my-1(v-for="(camera, i) in cameras", :key="camera.name" :data-camera-aos="camera.name" data-aos="fade-up" data-aos-duration="1000" data-aos-mirror="true")
          VideoCard(
            :camera="camera",
            cardClass="card"
            headerPosition="bottom",
            :linkToCamera="true",
            :notificationBell="true",
            :showSpinner="true",
            :onlySnapshot="true",
          )
  CoolLightBox(
    :items="notImages" 
    :index="notIndex"
    @close="closeHandler"
    :closeOnClickOutsideMobile="true"
    :useZoomBar="true",
    :zIndex=99999
  )
  Footer
</template>

<script>
import CoolLightBox from 'vue-cool-lightbox';
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';

import { getCameras, getCameraSettings, getCameraStatus } from '@/api/cameras.api';
import { getNotifications } from '@/api/notifications.api';
import BackToTop from '@/components/back-to-top.vue';
import BreadcrumbFilter from '@/components/breadcrumb-filter.vue';
import Footer from '@/components/footer.vue';
import Navbar from '@/components/navbar.vue';
import VideoCard from '@/components/video-card.vue';

import SocketMixin from '@/mixins/socket.mixin';

export default {
  name: 'Cameras',
  components: {
    BackToTop,
    BreadcrumbFilter,
    CoolLightBox,
    Footer,
    Navbar,
    VideoCard,
  },
  mixins: [SocketMixin],
  data() {
    return {
      cameras: [],
      loading: true,
    };
  },
  async mounted() {
    try {
      if (this.checkLevel('cameras:access')) {
        const cameras = await getCameras();

        for (const camera of cameras.data.result) {
          const settings = await getCameraSettings(camera.name);
          camera.settings = settings.data;

          const lastNotification = await getNotifications(`?cameras=${camera.name}&pageSize=5`);
          camera.lastNotification = lastNotification.data.result.length > 0 ? lastNotification.data.result[0] : false;

          this.cameras.push(camera);
          this.loading = false;
        }
      } else {
        this.$toast.error(this.$t('no_access'));
      }
    } catch (err) {
      this.$toast.error(err.message);
    }
  },
  methods: {
    async filterCameras(filter) {
      try {
        if (filter) {
          this.loading = true;
          this.cameras = [];
          const cameras = await getCameras();

          for (const camera of cameras.data.result) {
            const settings = await getCameraSettings(camera.name);
            camera.settings = settings.data;

            let camerasFilter = true;
            if (filter.cameras.length > 0) {
              camerasFilter = filter.cameras.includes(camera.name);
            }

            let roomsFilter = true;
            if (filter.rooms.length > 0) {
              roomsFilter = filter.rooms.includes(camera.settings.room);
            }

            let statusFilter = true;
            if (filter.status.length > 0) {
              const status = filter.status.map((filterStatus) => filterStatus.toLowerCase());
              let cameraStatus = await getCameraStatus(camera.name, camera.settings.pingTimeout);
              statusFilter = status.includes(cameraStatus.data.status.toLowerCase());
            }

            let show = camerasFilter && roomsFilter && statusFilter;
            if (show) {
              const lastNotification = await getNotifications(`?cameras=${camera.name}&pageSize=1`);
              camera.lastNotification =
                lastNotification.data.result.length > 0 ? lastNotification.data.result[0] : false;

              this.cameras.push(camera);
            }
          }

          this.loading = false;
        }
      } catch (err) {
        this.$toast.error(err.message);
      }
    },
  },
};
</script>

<style scoped>
.inner-container {
  margin-top: 140px;
}
</style>
