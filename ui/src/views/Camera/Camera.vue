<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .tw-max-w-4xl.pl-safe.pr-safe
        
    .tw-flex.tw-flex-wrap
      v-row.tw-w-full.tw-h-full
        v-col.tw-mb-3(:cols="cols")
          vue-aspect-ratio(ar="16:9" width="100%")
            VideoCard(:ref="camera.name" :camera="camera" stream noLink hideNotifications)
          
    v-col.tw-flex.tw-justify-between.tw-items-center.tw-mt-2(cols="12")
      .tw-w-full.tw-flex.tw-justify-between.tw-items-center
        .tw-block
          h2.tw-leading-6 {{ $route.params.name }}
          span.subtitle {{ camera.settings.room }}
        .tw-block
          v-btn.tw-text-white(fab small color="var(--cui-primary)" @click="$router.push(`/cameras/${camera.name}/feed`)")
            v-icon(size="20") {{ icons['mdiOpenInNew'] }}

    v-col.tw-px-0.tw-flex.tw-justify-between.tw-items-center.tw-mt-2(:cols="cols")
      v-expansion-panels(v-model="notificationsPanel" multiple)
        v-expansion-panel.notifications-panel(v-for="(item,i) in 1" :key="i")
          v-expansion-panel-header.notifications-panel-title.text-default.tw-font-bold {{ $t('notifications') }}
          v-expansion-panel-content.notifications-panel-content
            v-virtual-scroll(v-if="notifications.length" :items="notifications" item-height="74" max-height="400" bench="10" style="border-bottom-right-radius: 10px; border-bottom-left-radius: 10px;")
              template(v-slot:default="{ item }")
                v-list.tw-p-0(two-line dense)
                  v-list-item(v-for="(notification,i) in notifications" :key="notification.id" :class="i !== notifications.length - 1 ? 'notification-item' : ''")
                    v-list-item-avatar
                      v-avatar(size="40" color="black")
                        v-img(v-on:error="notification.error = true" :src="!notification.error ? `/files/${notification.recordType === 'Video' ? `${notification.name}@2.jpeg` : notification.fileName}` : require('../../assets/img/logo.png')" width="56")
                          template(v-slot:placeholder)
                            .tw-flex.tw-justify-center.tw-items-center.tw-h-full
                              v-progress-circular(indeterminate color="var(--cui-primary)" size="16")
                    v-list-item-content
                      v-list-item-title.text-default.tw-font-semibold {{ `${$t('movement_detected')} (${notification.label.includes("no label") ? $t("no_label") : notification.label.includes("Custom") ? $t("custom") : notification.label})` }}
                      v-list-item-subtitle.text-muted {{ `${$t('time')}: ${notification.time}` }}
                    v-list-item-action
                      v-btn.text-muted(icon @click="openGallery(notification)")
                        v-icon {{ icons['mdiPlusCircle'] }}
            .tw-flex.tw-justify-center.tw-items-center.tw-w-full(v-if="!notifications.length" style="height: 100px")
              v-list.tw-p-0(dense)
                v-list-item
                  v-list-item-content
                    v-list-item-title.text-muted.tw-font-semibold.tw-text-center {{ $t('no_notifications') }}

  LightBox(
    ref="lightbox"
    :media="images"
    :showLightBox="false"
    :showThumbs="false"
    showCaption
    disableScroll
  )

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
import { mdiOpenInNew, mdiPlusCircle } from '@mdi/js';
import VueAspectRatio from 'vue-aspect-ratio';

import { getCamera, getCameraSettings } from '@/api/cameras.api';
import { getNotifications } from '@/api/notifications.api';

import VideoCard from '@/components/camera-card.vue';

import socket from '@/mixins/socket';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Camera',

  components: {
    LightBox,
    VideoCard,
    'vue-aspect-ratio': VueAspectRatio,
  },

  mixins: [socket],

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  data: () => ({
    camera: {},
    cols: 12,
    icons: {
      mdiOpenInNew,
      mdiPlusCircle,
    },
    images: [],
    loading: true,
    notifications: [],
    notificationsPanel: [0],
    showNotifications: false,
  }),

  async mounted() {
    try {
      const camera = await getCamera(this.$route.params.name);
      const settings = await getCameraSettings(this.$route.params.name);

      camera.data.settings = settings.data;

      const lastNotifications = await getNotifications(`?cameras=${camera.data.name}&pageSize=5`);
      this.notifications = lastNotifications.data.result;

      this.images = lastNotifications.data.result.map((notification) => {
        if (notification.recordStoring) {
          let mediaContainer = {
            id: notification.id,
            type: 'image',
            caption: `${notification.camera} - ${notification.time}`,
            src: `/files/${notification.fileName}`,
            thumb: `/files/${notification.fileName}`,
          };

          if (notification.recordType === 'Video') {
            delete mediaContainer.src;

            mediaContainer = {
              ...mediaContainer,
              type: 'video',
              sources: [
                {
                  src: `/files/${notification.fileName}`,
                  type: 'video/mp4',
                },
              ],
              thumb: `/files/${notification.name}@2.jpeg`,
              width: '100%',
              height: 'auto',
              autoplay: false,
            };
          }

          return mediaContainer;
        }
      });

      this.camera = camera.data;

      this.loading = false;

      await timeout(10);
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  methods: {
    openGallery(notification) {
      if (notification.recordStoring) {
        const index = this.images.findIndex((el) => el.id === notification.id);
        this.$refs.lightbox.showImage(index);
      }
    },
    toggleNotificationsPanel() {
      this.showNotifications = !this.showNotifications;

      if (this.showNotifications) {
        this.notificationsPanel = [0];
      } else {
        this.notificationsPanel = [];
      }
    },
  },
};
</script>

<style scoped>
.subtitle {
  color: rgba(var(--cui-text-third-rgb)) !important;
}

.notifications-panel {
  background: rgba(var(--cui-bg-card-rgb)) !important;
}

.notifications-panel-title {
  /*border-bottom: 1px solid rgba(var(--cui-text-default-rgb), 0.1);*/
}

.notifications-panel-content {
  color: rgba(var(--cui-text-default-rgb));
}

.notification-item {
  border-bottom: 1px solid rgba(var(--cui-text-default-rgb), 0.1);
}

div >>> .v-badge__badge {
  font-size: 8px;
  height: 15px;
  min-width: 15px;
  padding: 3px 3px;
}

div >>> .theme--light.v-btn.v-btn--disabled .v-icon {
  color: rgba(var(--cui-text-default-rgb), 0.4) !important;
}

div >>> .v-expansion-panel-content__wrap {
  padding: 0;
}

div >>> .theme--light.v-expansion-panels .v-expansion-panel-header .v-expansion-panel-header__icon .v-icon {
  color: rgba(var(--cui-text-default-rgb)) !important;
}
</style>
