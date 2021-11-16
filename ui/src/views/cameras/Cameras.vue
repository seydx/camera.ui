<template lang="pug">
div
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
      .row.justify-content-center
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
      div(data-aos="fade-up" data-aos-duration="1000")
        infinite-loading(:identifier="infiniteId", @infinite="infiniteHandler")
          div(slot="spinner")
            b-spinner.text-color-primary
          div.mt-3(slot="no-more") {{ $t("no_more_cameras") }}
          div(slot="no-results") {{ $t("no_cameras") }} :(
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
import InfiniteLoading from 'vue-infinite-loading';
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';

import { getCameras, getCameraSettings, getCameraStatus } from '@/api/cameras.api';
import { getNotifications } from '@/api/notifications.api';
import BreadcrumbFilter from '@/components/breadcrumb-filter.vue';
import VideoCard from '@/components/video-card.vue';
import SocketMixin from '@/mixins/socket.mixin';

export default {
  name: 'Cameras',
  components: {
    BreadcrumbFilter,
    CoolLightBox,
    InfiniteLoading,
    VideoCard,
  },
  mixins: [SocketMixin],
  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },
  data() {
    return {
      cameras: [],
      infiniteId: Date.now(),
      loading: true,
      page: 1,
      query: '',
    };
  },
  async mounted() {
    this.loading = false;
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
    async infiniteHandler($state) {
      try {
        if (this.checkLevel('cameras:access')) {
          const response = await getCameras(`?refresh=true&page=${this.page || 1}` + this.query);

          for (const camera of response.data.result) {
            const settings = await getCameraSettings(camera.name);
            camera.settings = settings.data;

            const lastNotification = await getNotifications(`?cameras=${camera.name}&pageSize=5`);
            camera.lastNotification = lastNotification.data.result.length > 0 ? lastNotification.data.result[0] : false;
          }

          if (response.data.result.length > 0) {
            this.page += 1;
            this.cameras = [...this.cameras, ...response.data.result];
            $state.loaded();
          } else {
            $state.complete();
          }
        } else {
          this.$toast.error(this.$t('no_access'));
          $state.complete();
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
  margin-top: 120px;
}
</style>
