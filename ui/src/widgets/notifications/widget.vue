<template lang="pug">
.content.tw-h-full.tw-overflow-x-hidden
  .tw-flex.tw-justify-between.tw-mt-1.tw-relative.tw-z-5(style="height: 25px;")
    .tw-ml-2.tw-text-xs.tw-font-bold.text-muted {{ $t('notifications') }}

  .tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading" style="height: calc(100% - 24px - 0.25rem)")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")

  .tw-w-full.tw-overflow-x-hidden(v-else style="height: calc(100% - 25px - 0.25rem)")
    .tw-py-4.tw-pt-2.tw-px-2(v-if="notifications.length")
      v-row.overflow-hidden
        v-col.tw-py-1(v-for="(notification,i) in notifications" :key="notification.id" cols="12")
          v-card.tw-p-2.tw-relative(elevation="1")
            v-btn.notification-goto-button(to="/notifications" icon small)
              v-icon {{ icons['mdiChevronRight'] }}
            .tw-flex.tw-justify-between.tw-items-center.notifications-card-title
              v-card-title.tw-text-sm.tw-p-0 {{ notification.title || notification.camera || $t('notification') }}
                v-chip.tw-ml-2(x-small v-if="notification.type === 'ERROR'" color="error") {{ $t('error') }}
                v-chip.tw-ml-2(x-small v-else-if="notification.type === 'WARN'" color="yellow") {{ $t('warning') }}
                v-chip.tw-ml-2(x-small v-else-if="notification.label" :color="notification.label === 'Homebridge' ? 'purple' : 'grey'") {{ notification.label.includes("no label") ? $t("no_label") : notification.label.includes("Custom") ? $t("custom") : notification.label }}
            .tw-flex.tw-justify-start.tw-items-center.tw-mt-1
              v-card-subtitle.tw-p-0.text-muted.tw-font-normal.text-truncate {{ notification.message }}
    .tw-absolute.tw-inset-0.tw-flex.tw-justify-center.tw-items-center(v-else)
      .text-muted {{ $t('no_notifications') }}
              
</template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiChevronRight } from '@mdi/js';

import { getNotifications } from '@/api/notifications.api';

export default {
  name: 'NotificationsWidget',

  props: {
    item: Object,
  },

  data: () => ({
    loading: true,

    icons: {
      mdiChevronRight,
    },

    notifications: [],
  }),

  async mounted() {
    try {
      const lastNotifications = await getNotifications('?pageSize=5');
      this.notifications = lastNotifications.data.result;

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

      this.$socket.client.on('notification', this.handleNotification);

      this.loading = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    this.$socket.client.off('notification', this.handleNotification);
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

.notification-goto-button {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.3);
  color: #fff !important;
}
</style>
