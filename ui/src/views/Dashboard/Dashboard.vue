<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .tw-max-w-10xl.pl-safe.pr-safe.tw-mb-5
  
    .tw-flex.tw-justify-between.tw-items-center
      .tw-block
        h2.tw-leading-10 {{ $t($route.name.toLowerCase()) }}
        span.tw-leading-3.subtitle {{ $t('welcome_back') }}, 
          b Seydx

      .tw-block
        v-menu.tw-z-30(v-if="checkLevel('settings:edit')" v-model="showCardsMenu" transition="slide-y-transition" min-width="250px" :close-on-content-click="false" offset-y bottom left nudge-top="-15" content-class="light-shadow")
          template(v-slot:activator="{ on, attrs }")
            v-btn.text-muted.tw-mr-1(icon height="38px" width="38px" v-bind="attrs" v-on="on")
              v-icon mdi-cog

          v-card.light-shadow.card-border.dropdown-content(max-width="360px")
            .tw-flex.tw-justify-between.tw-items-center.tw-py-3.tw-px-5.dropdown-title
              v-card-subtitle.tw-p-0.tw-m-0.tw-text-sm.tw-font-medium {{ $t('favourites') }}
            v-divider
            v-card-text.tw-py-3.tw-px-5.text-center
              v-virtual-scroll(v-if="allCameras.length" :items="allCameras" item-height="64" height="192" bench="10")
                template(v-slot:default="{ item, index }")
                  v-list.tw-p-0
                    v-list-item.dropdown-content.tw-p-0(inactive)
                      v-list-item-content
                        v-list-item-title
                          .text-left.tw-text-sm.tw-font-medium {{ item.name }}
                      v-list-item-action.tw-pr-4
                        v-switch.tw-m-0(v-model="item.favourite" @change="updateLayout(item.name, item.favourite)" color="rgba(var(--cui-primary-700-rgb))")
                    v-divider(v-if="index !== allCameras.length - 1")

              span.text-font-default(v-else) {{ $t('no_cameras') }}

    draggable.tw-mt-8.layout.row.wrap(v-model='cameras', ghost-class="ghost-box", @change="storeLayout", animation=200, delay="200" delay-on-touch-only="true")
      v-flex.tw-mb-5.tw-px-2(xs12 sm6 md4 lg3 v-for="camera in cameras" :key="camera.name" :style="`height: ${height}px`")
        VideoCard(:ref="camera.name" :camera="camera" title titlePosition="top" status :stream="camera.live" :refreshSnapshot="!camera.live" :notifications="Boolean(camera.lastNotification)")

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
import draggable from 'vuedraggable';

import { getCameras, getCameraSettings } from '@/api/cameras.api';
import { getNotifications } from '@/api/notifications.api';
import { getSetting, changeSetting } from '@/api/settings.api';

import VideoCard from '@/components/camera-card.vue';

import socket from '@/mixins/socket';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Dashboard',

  components: {
    CoolLightBox,
    draggable,
    VideoCard,
  },

  mixins: [socket],

  data: () => ({
    allCameras: [],
    cameras: [],
    loading: true,
    showCardsMenu: false,
  }),

  computed: {
    dashboardLayout() {
      return this.$store.state.dashboard.layout;
    },
    height() {
      switch (this.$vuetify.breakpoint.name) {
        case 'xs':
          return 300;
        case 'sm':
          return 250;
        case 'md':
          return 225;
        case 'lg':
          return 225;
        case 'xl':
          return 250;
        default:
          return 250;
      }
    },
  },

  async mounted() {
    try {
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
      }

      this.allCameras = cameras.data.result;
      this.cameras = cameras.data.result.filter((camera) => camera.favourite);

      this.loading = false;

      await timeout(10);

      this.getLayout();
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  methods: {
    getLayout() {
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
    storeLayout() {
      this.$store.dispatch(
        'dashboard/updateElements',
        this.cameras
          .map((camera, index) => {
            return {
              index: index,
              name: camera.name,
            };
          })
          .filter((camera) => camera)
      );
    },
    async updateLayout(cameraName, state) {
      try {
        const camera = this.allCameras.find((camera) => camera && camera.name === cameraName);
        const cameraSettings = await getSetting('cameras');

        for (const cameraSetting of cameraSettings.data) {
          if (cameraSetting.name === camera.name) {
            cameraSetting.dashboard.favourite = state;
          }
        }

        await changeSetting('cameras', cameraSettings.data);

        if (state) {
          this.cameras.push(camera);
        } else {
          this.cameras = this.cameras.filter((camera) => camera && camera.name !== cameraName);
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
  },
};
</script>

<style scoped>
.subtitle {
  color: rgba(var(--cui-text-third-rgb)) !important;
}

.dropdown-title {
  background: rgba(var(--cui-menu-title-rgb)) !important;
}

.dropdown-content {
  background: rgba(var(--cui-menu-default-rgb)) !important;
}

.ghost-box {
  opacity: 0.2;
}
</style>
