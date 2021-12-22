<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .pl-safe.pr-safe

    .header.tw-justify-between.tw-items-center.header.tw-relative.tw-z-10.tw-items-stretch
      .tw-block
        h2 {{ $t($route.name.toLowerCase()) }}
      .header-utils
        v-btn(icon height="38px" width="38px" color="red" :disabled="!notifications.length" @click="removeAll")
          v-icon {{ icons['mdiDelete'] }}
        FilterCard(camerasSelect datePicker labelSelect roomSelect typeSelect @filter="filter")

    v-row.tw-mt-5.overflow-hidden
      v-col(v-for="(notification,i) in notifications" :key="notification.id" cols="12")
        NotificationCard(ref="notifications" :notification="notification" @remove="remove(notification, i)" @show="showNotification(notification)" @slideStart="closeNotifications(notification)")

    infinite-loading(:identifier="infiniteId", @infinite="infiniteHandler")
      .tw-mt-10(slot="spinner")
        v-progress-circular(indeterminate color="var(--cui-primary)")
      .tw-mt-10.tw-text-sm.text-muted(slot="no-more") {{ $t("no_more_notifications") }}
      .tw-mt-10.tw-text-sm.text-muted(slot="no-results") {{ $t("no_notifications") }}
          
  CoolLightBox(
    :items="images" 
    :index="index"
    @close="index = null"
    :closeOnClickOutsideMobile="true"
    :useZoomBar="true",
    :zIndex=99999
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
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';
import CoolLightBox from 'vue-cool-lightbox';
import InfiniteLoading from 'vue-infinite-loading';
import { mdiDelete } from '@mdi/js';

import { getNotifications, removeNotification, removeNotifications } from '@/api/notifications.api';

import FilterCard from '@/components/filter.vue';
import NotificationCard from '@/components/notification-card.vue';

import socket from '@/mixins/socket';

export default {
  name: 'Notifications',

  components: {
    CoolLightBox,
    FilterCard,
    InfiniteLoading,
    NotificationCard,
  },

  mixins: [socket],

  data: () => ({
    icons: {
      mdiDelete,
    },
    images: [],
    index: null,
    infiniteId: Date.now(),
    loading: false,
    notifications: [],
    page: 1,
    query: '',
  }),

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  mounted() {
    this.loading = false;
  },

  methods: {
    closeNotifications(notification) {
      this.$refs.notifications.forEach((ref) => {
        if (ref.notification.id !== notification.id) {
          ref.onClickOutside();
        }
      });
    },
    filter(filterQuery) {
      this.loading = true;
      this.notifications = [];
      this.page = 1;
      this.query = filterQuery;
      this.infiniteId = Date.now();
      this.loading = false;
    },
    async infiniteHandler($state) {
      try {
        const response = await getNotifications(`?page=${this.page || 1}` + this.query);

        if (response.data.result.length > 0) {
          this.page += 1;
          this.notifications = [...this.notifications, ...response.data.result];

          this.notifications = this.notifications.map((not) => {
            if (!not.message) {
              if (not.camera && not.room) {
                not.message = this.$t('notification_text').replace('@', not.camera).replace('%', not.room);
              } else {
                not.message = this.$t('movement_detected');
              }
            }

            return not;
          });

          this.images = this.notifications
            .map((notification) => {
              if (notification.recordStoring) {
                return {
                  id: notification.id,
                  title: `${notification.camera} - ${notification.time}`,
                  src: `/files/${notification.fileName}`,
                  thumb:
                    notification.recordType === 'Video'
                      ? `/files/${notification.name}@2.jpeg`
                      : `/files/${notification.fileName}`,
                };
              }
            })
            .filter((notification) => notification);

          $state.loaded();
        } else {
          $state.complete();
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    showNotification(notification) {
      if (notification.recordStoring) {
        this.index = this.images.findIndex((el) => el.id === notification.id);
      }
    },
    async remove(notification, index) {
      try {
        await removeNotification(notification.id);
        this.$store.dispatch('notifications/decrease');

        this.notifications.splice(index, 1);

        if (notification.src) {
          const imgIndex = this.images.findIndex((el) => el.id === notification.id);
          this.images.splice(imgIndex, 1);
        }

        this.$toast.success(`${this.$t('notification')} ${this.$t('removed')}!`);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    async removeAll() {
      try {
        await removeNotifications();

        this.$store.dispatch('notifications/removeAll');
        this.notifications = [];
        this.images = [];
        this.$toast.success(this.$t('all_notifications_removed'));
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
  },
};
</script>

<style scoped>
div >>> .theme--light.v-expansion-panels .v-expansion-panel-header .v-expansion-panel-header__icon .v-icon {
  color: rgba(var(--cui-text-default-rgb)) !important;
}

.theme--light.v-btn.v-btn--disabled,
.theme--light.v-btn.v-btn--disabled .v-icon,
.theme--light.v-btn.v-btn--disabled .v-btn__loading {
  color: var(--cui-text-disabled) !important;
}

.header {
  display: flex;
}

.header-utils {
  display: block;
}

@media (max-width: 360px) {
  .header {
    display: block;
  }

  .header-utils {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
  }
}
</style>
