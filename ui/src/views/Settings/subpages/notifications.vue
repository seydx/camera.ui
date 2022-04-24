<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-7(v-if="!loading")
    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="notifications.active")

    label.form-input-label {{ $t('remove_after') }}
    v-select(:suffix="$t('hours')" :value="notifications.removeAfter" v-model="notifications.removeAfter" :items="removeAfterTimer" prepend-inner-icon="mdi-timelapse" background-color="var(--cui-bg-card)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiTimelapse'] }}

    v-divider.tw-mt-4.tw-mb-8

    .page-subtitle.tw-mt-8 {{ $t('alexa') }}
    .page-subtitle-info {{ $t('config') }}

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="notifications.alexa.active")

    .tw-flex.tw-justify-between.tw-items-center.tw-mb-4
      label.form-input-label {{ $t('status') }}
      v-progress-circular.tw-ml-auto(v-if="loadingAlexa" size="22" indeterminate color="var(--cui-primary)")
      a.alexaConnect(:href="`http://${alexaHost}:${notifications.alexa.proxy.port}`", @click.prevent="alexaReconnect" v-if="!loadingAlexa && !alexaPing") {{ $t("reconnect") }}
      span.tw-text-green-500.tw-ml-auto(v-if="!loadingAlexa && alexaPing") {{ $t("connected") }}

    label.form-input-label {{ $t('domain') }}
    v-text-field(v-model="notifications.alexa.domain" label="amazon.de | amazon.com | amazon.co.uk" prepend-inner-icon="mdi-domain" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiDomain'] }}

    label.form-input-label {{ $t('port') }}
    v-text-field(v-model.number="notifications.alexa.proxy.port" type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiNumeric'] }}

    label.form-input-label {{ $t('serialNr') }}
    v-text-field(v-model="notifications.alexa.serialNr" prepend-inner-icon="mdi-identifier" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiIdentifier'] }}

    label.form-input-label {{ $t('message') }}
    v-text-field(v-model="notifications.alexa.message" prepend-inner-icon="mdi-message" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiMessage'] }}

    label.form-input-label {{ $t('speaker_start_time') }}
    v-dialog(ref="fromDialog" v-model="modalFrom" :return-value.sync="notifications.alexa.startTime" width="290px")
      template(v-slot:activator="{ on, attrs }")
        v-text-field(solo v-model="notifications.alexa.startTime" prepend-inner-icon="mdi-clock-time-four-outline" readonly v-bind="attrs" v-on="on")
          template(v-slot:prepend-inner)
            v-icon.text-muted {{ icons['mdiClockTimeFourOutline'] }}
      v-time-picker(v-if="modalFrom" v-model="notifications.alexa.startTime" format="24hr" full-width)
        v-spacer
        v-btn(text color="var(--cui-primary)" @click="modalFrom = false") {{ $t('cancel') }}
        v-btn(text color="var(--cui-primary)" @click="$refs.fromDialog.save(notifications.alexa.startTime)") {{ $t('ok') }}

    label.form-input-label {{ $t('speaker_end_time') }}
    v-dialog(ref="toDialog" v-model="modalTo" :return-value.sync="notifications.alexa.endTime" width="290px")
      template(v-slot:activator="{ on, attrs }")
        v-text-field(solo v-model="notifications.alexa.endTime" prepend-inner-icon="mdi-clock-time-four-outline" readonly v-bind="attrs" v-on="on")
          template(v-slot:prepend-inner)
            v-icon.text-muted {{ icons['mdiClockTimeFourOutline'] }}
      v-time-picker(v-if="modalTo" v-model="notifications.alexa.endTime" format="24hr" full-width)
        v-spacer
        v-btn(text color="var(--cui-primary)" @click="modalTo = false") {{ $t('cancel') }}
        v-btn(text color="var(--cui-primary)" @click="$refs.toDialog.save(notifications.alexa.endTime)") {{ $t('ok') }}

    v-divider.tw-mt-4.tw-mb-8
    
    .page-subtitle.tw-mt-8 {{ $t('telegram') }}
    .page-subtitle-info {{ $t('config') }}

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="notifications.telegram.active")

    label.form-input-label {{ $t('token') }}
    v-text-field(v-model="notifications.telegram.token" prepend-inner-icon="mdi-security" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiSecurity'] }}

    label.form-input-label {{ $t('chat_id') }}
    v-text-field(v-model="notifications.telegram.chatID" prepend-inner-icon="mdi-identifier" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiIdentifier'] }}

    label.form-input-label {{ $t('message') }}
    v-text-field(v-model="notifications.telegram.message" prepend-inner-icon="mdi-message" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiMessage'] }}

    v-divider.tw-mt-4.tw-mb-8
    
    .page-subtitle.tw-mt-8 {{ $t('webhook') }}
    .page-subtitle-info {{ $t('config') }}

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="notifications.webhook.active")

</template>

<script>
import {
  mdiClockTimeFourOutline,
  mdiDomain,
  mdiIdentifier,
  mdiMessage,
  mdiNumeric,
  mdiSecurity,
  mdiTimelapse,
} from '@mdi/js';
import { getSetting, changeSetting } from '@/api/settings.api';

export default {
  name: 'NotificationsSettings',

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data() {
    return {
      icons: {
        mdiClockTimeFourOutline,
        mdiDomain,
        mdiIdentifier,
        mdiMessage,
        mdiNumeric,
        mdiSecurity,
        mdiTimelapse,
      },

      modalFrom: false,
      modalTo: false,

      loading: true,
      loadingAlexa: false,
      loadingProgress: true,

      cameras: [],
      camerasTimeout: null,

      notifications: {},
      notificationsTimeout: null,

      alexaHost: window.location.hostname,
      alexaPing: false,

      removeAfterTimer: [
        { value: 1, text: '1' },
        { value: 3, text: '3' },
        { value: 6, text: '6' },
        { value: 12, text: '12' },
        { value: 24, text: '24' },
        { value: 0, text: this.$t('never') },
      ],
    };
  },

  async created() {
    try {
      const notifications = await getSetting('notifications');
      this.notifications = notifications.data;

      const cameras = await getSetting('cameras');
      this.cameras = cameras.data;

      this.$watch('cameras', this.camerasWatcher, { deep: true });
      this.$watch('notifications', this.notificationsWatcher, { deep: true });

      this.alexaActive();

      this.loading = false;
      this.loadingProgress = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  methods: {
    async alexaActive() {
      try {
        if (this.notifications.alexa.active) {
          this.loadingAlexa = true;

          const alexa = { ...this.notifications.alexa };

          const alexaConfigured =
            alexa.active &&
            alexa.domain &&
            alexa.auth.cookie &&
            alexa.auth.macDms.device_private_key &&
            alexa.auth.macDms.device_private_key &&
            alexa.proxy.port;

          if (!alexaConfigured) {
            this.alexaPing = false;
          } else {
            const status = await getSetting('notifications', '?pingAlexa=true');
            this.alexaPing = status.data.status === 'success';
          }

          this.loadingAlexa = false;
        }
      } catch (err) {
        this.loadingAlexa = false;

        console.log(err);
        this.$toast.error(err.message);
      }
    },
    async alexaReconnect() {
      try {
        this.loadingAlexa = true;

        setTimeout(() => {
          window.open(`http://${this.alexaHost}:${this.notifications.alexa.proxy.port}`, '_blank');
        }, 5000);

        this.notifications.alexa.auth.cookie = false;
        this.notifications.alexa.auth.macDms = false;

        const alexa = { ...this.notifications.alexa };
        alexa.proxy.clientHost = this.alexaHost;

        await changeSetting('notifications', alexa, '?reconnectAlexa=true');
        const status = await getSetting('notifications', '?pingAlexa=true');
        this.alexaPing = status.data.status === 'success';

        const notifications = await getSetting('notifications');
        this.notifications = notifications.data;
        this.removeTimer = notifications.data.removeAfter;

        this.loadingAlexa = false;
      } catch (err) {
        this.loadingAlexa = false;

        console.log(err);
        this.$toast.error(err.message);
      }
    },
    async camerasWatcher(newValue) {
      this.loadingProgress = true;

      if (this.camerasTimeout) {
        clearTimeout(this.camerasTimeout);
        this.camerasTimeout = null;
      }

      this.camerasTimeout = setTimeout(async () => {
        try {
          await changeSetting('cameras', newValue, '?stopStream=true');
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }

        this.loadingProgress = false;
      }, 2000);
    },
    async notificationsWatcher(newValue) {
      this.loadingProgress = true;

      if (this.notificationsTimeout) {
        clearTimeout(this.notificationsTimeout);
        this.notificationsTimeout = null;
      }

      this.notificationsTimeout = setTimeout(async () => {
        try {
          let params = '';

          if (this.removeTimer !== newValue.removeAfter) {
            this.removeTimer = newValue.removeAfter;
            params = '?cleartimer=restart';
          }

          await changeSetting('notifications', newValue, params);
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }

        this.loadingProgress = false;
      }, 2000);
    },
  },
};
</script>

<style scoped>
.alexaConnect {
  color: #ff5252;
  text-decoration: none;
}
</style>
