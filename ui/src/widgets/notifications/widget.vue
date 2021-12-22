<template lang="pug">
.content.tw-h-full
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  .tw-h-full(v-else)
    .tw-py-4.tw-px-2(v-if="notifications.length")
      v-row.overflow-hidden
        v-col.tw-py-1(v-for="(notification,i) in notifications" :key="notification.id" cols="12")
          v-card.tw-p-2(elevation="1")
            .tw-flex.tw-justify-between.tw-items-center.notifications-card-title
              v-card-title.tw-text-base.tw-p-0 {{ notification.title || notification.camera || $t('notification') }}
              .tw-block
                v-icon.text-muted {{ icons['ClockTimeNineOutline'] }}
                span.tw-p-0.text-muted.tw-text-xs.tw-pt-4.tw-ml-2 {{ notification.time }}
            .tw-flex.tw-justify-start.tw-items-center.tw-mt-1
              v-card-subtitle.tw-p-0.text-muted.tw-font-normal.text-truncate {{ notification.message }}
    .tw-h-full.tw-w-full.tw-flex.tw-justify-center.tw-items-center(v-else)
      span.text-muted {{ $t('no_notifications') }}
              
</template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiClockTimeNineOutline } from '@mdi/js';

import { getNotifications } from '@/api/notifications.api';

import NotificationCard from '@/components/notification-card.vue';

export default {
  name: 'NotificationsWidget',

  components: { NotificationCard },

  props: {
    item: Object,
  },

  data: () => ({
    loading: true,

    icons: {
      mdiClockTimeNineOutline,
    },

    notifications: [],
  }),

  async mounted() {
    try {
      const lastNotifications = await getNotifications('?pageSize=5');
      this.notifications = lastNotifications.data.result;

      this.$socket.client.on('notification', this.handleNotification);

      this.loading = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    this.$socket.client.off(this.camera.name, this.handleNotification);
  },

  methods: {
    handleNotification(notification) {
      this.notifications.push(notification);

      if (this.notifications.length > 5) {
        const length = this.notifications.length - 5;
        this.notifications = this.notifications.slice(0, -length);
      }
    },
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  background: var(--cui-bg-default);
  border-radius: 13px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
  overflow: auto;
}

.notifications-card {
  padding: 1rem;
  border-radius: 15px;
  background: var(--cui-bg-card);
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
}
</style>
