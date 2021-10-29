<template lang="pug">
div
  BackToTop
  Navbar(:name="$route.params.name")
  main.inner-container.w-100.h-100vh-calc.pt-save.footer-offset
    .container.pt-3.d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
      b-spinner.text-color-primary
    #streamBox.container.pt-3(v-else-if="!loading && Object.keys(camera).length")
      .card.overflow-hidden.bg-dark(style="border-radius: 7px !important;")
        VideoCard(
          :ref="camera.name"
          :key="camera.name",
          :camera="camera",
          cardClass="w-100 h-100",
          :fullsize="true",
          :showFullsizeIndicator="true",
          :showRefreshIndicator="true",
          :showSpinner="true",
          :onlyStream="true",
          @refreshStream="refreshStreamProcess"
        )
      b-card-title.mb-0.ml-1.mt-3 {{ $route.params.name }}
      b-card-text.text-muted-2.ml-1 {{ camera.settings.room }}
      .notifications-card
        b-card-title.notification-title.mb-4 {{ $t("notifications") }}
        ul(v-if="camera.lastNotifications.length")
          li(v-for="(notification, i) in camera.lastNotifications")
            b-link(
              @click="notification.recordStoring ? index = i : index = null"
            )
              b {{ notification.camera + ": " }}
              | {{ notification.time }}
            b-link.float-right.text-color-primary(
              @click="notification.recordStoring ? index = i : index = null"
            )
              b-icon(icon="arrow-right-circle-fill")
        ul(v-else)
          li.text-center {{ $t("no_notifications") }}
      CoolLightBox(
        :items="images" 
        :index="index"
        @close="index = null"
        :closeOnClickOutsideMobile="true"
        :useZoomBar="true"
      )
  Footer
</template>

<script>
import { BIcon, BIconArrowRightCircleFill } from 'bootstrap-vue';
import CoolLightBox from 'vue-cool-lightbox';
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';

import { getCamera, getCameraSettings } from '@/api/cameras.api';
import { getNotifications } from '@/api/notifications.api';

import BackToTop from '@/components/back-to-top.vue';
import Footer from '@/components/footer.vue';
import Navbar from '@/components/navbar.vue';
import VideoCard from '@/components/video-card.vue';

import SocketMixin from '@/mixins/socket.mixin';

export default {
  name: 'Camera',
  components: {
    BackToTop,
    BIcon,
    BIconArrowRightCircleFill,
    CoolLightBox,
    Footer,
    Navbar,
    VideoCard,
  },
  mixins: [SocketMixin],
  data() {
    return {
      camera: {},
      images: [],
      index: null,
      loading: true,
    };
  },
  sockets: {
    connect() {
      if (this.connected) {
        if (this.camera.live) {
          this.refreshStreamSocket({ camera: this.camera.name });
        }
      }
    },
  },
  async mounted() {
    try {
      if (this.checkLevel('cameras:access')) {
        const camera = await getCamera(this.$route.params.name);
        const settings = await getCameraSettings(this.$route.params.name);

        camera.data.settings = settings.data;

        const lastNotifications = await getNotifications(`?cameras=${camera.data.name}&pageSize=5`);
        camera.data.lastNotifications = lastNotifications.data.result;

        this.images = lastNotifications.data.result.map((not) => {
          return {
            title: `${not.camera} - ${not.time}`,
            src: `/files/${not.fileName}`,
            thumb: not.recordType === 'Video' ? `/files/${not.name}@2.jpeg` : `/files/${not.fileName}`,
          };
        });

        this.$socket.client.on(camera.data.name, (data) => {
          if (this.$refs[camera.data.name]) {
            this.$refs[camera.data.name].writeStream(data);
          }
        });

        this.camera = camera.data;
        this.loading = false;
      } else {
        this.$toast.error(this.$t('no_access'));
      }
    } catch (err) {
      this.$toast.error(err.message);
    }
  },
  methods: {
    refreshStreamProcess(event) {
      if (this.$refs[event.camera]) {
        this.$refs[event.camera].pauseStream(true);
      }

      this.$socket.client.emit('refresh_stream', { feed: event.camera });
    },
    refreshStreamSocket(event) {
      if (this.$refs[event.camera]) {
        this.$refs[event.camera].pauseStream(true);
      }

      this.$socket.client.emit('rejoin_stream', { feed: event.camera });
    },
  },
};
</script>

<style scoped>
.inner-container {
  margin-top: 100px;
}

.notifications-card {
  height: 100%;
  padding: 1rem;
  margin-top: 60px;
  -webkit-box-shadow: rgba(0, 0, 0, 0.68) 0px 17px 28px -21px;
  box-shadow: rgba(0, 0, 0, 0.68) 0px 17px 28px -21px;
  background-color: var(--secondary-bg-color);
  border-radius: 0.5rem;
  border-bottom: 3px solid var(--third-bg-color);
}

.notifications-card ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.notifications-card ul li {
  padding: 10px 10px;
  border-bottom: 1px solid rgb(0 0 0 / 10%);
}

.notifications-card ul li:last-child {
  border-bottom: none;
}

.notifications-card ul li a {
  color: var(--primary-font-color);
  font-size: 0.9rem;
  transition: 0.3s all;
}

.notifications-card ul li a:hover {
  color: var(--primary-color);
}

.notification-title {
  font-size: 1rem !important;
}

.canvas,
.card >>> .canvas {
  background: #000000;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  margin: 0;
  padding: 0;
  display: block;
  width: 100%;
  border-radius: 0.5rem;
}

/* Equal-height card images, cf. https://stackoverflow.com/a/47698201/1375163*/
.img-overlay,
.card >>> .img-overlay {
  /*height: 11vw;*/
  height: 50vw;
  /*max-height: 375px;*/
}
/* Small devices (landscape phones, 576px and up) */
@media (min-width: 576px) {
  .img-overlay,
  .card >>> .img-overlay {
    height: 40vw;
  }
}
/* Medium devices (tablets, 768px and up) */
@media (min-width: 768px) {
  .img-overlay,
  .card >>> .img-overlay {
    height: 40vw;
  }
}
/* Large devices (desktops, 992px and up) */
@media (min-width: 992px) {
  .img-overlay,
  .card >>> .img-overlay {
    height: 35vw;
  }
}
/* Extra large devices (large desktops, 1200px and up) */
@media (min-width: 1200px) {
  .img-overlay,
  .card >>> .img-overlay {
    height: 40vw;
  }
}
</style>
