<template lang="pug">
.w-100.h-100
  vue-progress-bar
  .d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
    b-spinner.text-color-primary
  transition-group(name="fade", mode="out-in", v-if="loading")
  transition-group(name="fade", mode="out-in", v-else)
    .d-flex.flex-wrap.justify-content-between(key="loaded")
      .col-12(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel(['settings:cameras:edit', 'settings:notifications:edit'])")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.notifications.notifications.expand ? "180" : "-90"', @click="settingsLayout.notifications.notifications.expand = !settingsLayout.notifications.notifications.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.notifications.notifications.expand = !settingsLayout.notifications.notifications.expand") {{ $t("notifications") }}
        b-collapse(
          v-model="settingsLayout.notifications.notifications.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="notifications.active"
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    :aria-expanded="notifications.active ? 'true' : 'false'"
                    aria-controls="notifications"
                  )
              b-collapse(
                v-model="notifications.active"
              )
                hr.hr-underline(v-if="notifications.active")
                .row(v-if="notifications.active")
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("remove_after_h") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-select(
                      v-model="notifications.removeAfter"
                      :options="removeAfterTimer"
                    )
      b-collapse.w-100(
        v-model="notifications.active"
      )
        .col-12.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel(['settings:cameras:edit', 'settings:notifications:edit'])")
          b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.notifications.alexa.expand ? "180" : "-90"', @click="settingsLayout.notifications.alexa.expand = !settingsLayout.notifications.alexa.expand")
          h5.cursor-pointer.settings-box-top(@click="settingsLayout.notifications.alexa.expand = !settingsLayout.notifications.alexa.expand") {{ $t("alexa") }}
          b-collapse(
            v-model="settingsLayout.notifications.alexa.expand"
          )
            div.mt-2.mb-4
              .settings-box.container
                .row
                  .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                  .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="notifications.alexa.active"
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true",
                      :aria-expanded="notifications.alexa.active ? 'true' : 'false'"
                      aria-controls="alexa"
                      @change="alexaActive"
                    )
                b-collapse(
                  v-model="notifications.alexa.active"
                )
                  hr.hr-underline(v-if="notifications.alexa.active")
                  .row(v-if="notifications.alexa.active")
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("domain") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                      b-form-input(
                        type='text',
                        placeholder="amazon.de",
                        v-model="notifications.alexa.domain"
                      )
                  hr.hr-underline(v-if="notifications.alexa.active")
                  .row(v-if="notifications.alexa.active")
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("port") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                      b-form-input(
                        type='text',
                        placeholder=9494,
                        tyoe="number",
                        v-model="notifications.alexa.proxy.port"
                      )
                  hr.hr-underline(v-if="notifications.alexa.active")
                  .row(v-if="notifications.alexa.active")
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("serialNr") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                      b-form-input(
                        type='text',
                        placeholder="G0XXXXXXXXXXXX",
                        v-model="notifications.alexa.serialNr"
                      )
                  hr.hr-underline(v-if="notifications.alexa.active")
                  .row(v-if="notifications.alexa.active")
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("motion_message") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                      b-form-input(
                        type='text',
                        :placeholder="$t('motion_message')",
                        v-model="notifications.alexa.message"
                      )
                  hr.hr-underline(v-if="notifications.alexa.active")
                  div(v-if="notifications.alexa.active")
                    div(v-for="(camera, index) in cameras", :key="camera.name")
                      .row(:id='"alexa" + index')
                        .col-12.d-flex.flex-wrap.align-content-center {{ camera.name }}
                        .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                          b-form-select(
                            v-model="camera.alexa"
                            :options="alexaOptions"
                          )
                      hr.hr-underline
                  hr.hr-underline(v-if="notifications.alexa.active")
                  .row(v-if="notifications.alexa.active")
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("speaker_start_time") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                      b-input-group
                        b-form-input(
                          id="speakerStartTime"
                          v-model="notifications.alexa.startTime"
                          type="text"
                          placeholder="HH:mm"
                        )
                        b-input-group-append
                          b-form-timepicker(
                            v-model="notifications.alexa.startTime"
                            button-only
                            no-close-button
                            right
                            aria-controls="speakerStartTime"
                            class="timePicker"
                          )
                  hr.hr-underline(v-if="notifications.alexa.active")
                  .row(v-if="notifications.alexa.active")
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("speaker_end_time") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                      b-input-group
                        b-form-input(
                          id="speakerEndTime"
                          v-model="notifications.alexa.endTime"
                          type="text"
                          placeholder="HH:mm"
                        )
                        b-input-group-append
                          b-form-timepicker(
                            v-model="notifications.alexa.endTime"
                            button-only
                            no-close-button
                            right
                            aria-controls="speakerEndTime"
                            class="timePicker"
                          )
                  hr.hr-underline(v-if="notifications.alexa.active && notifications.alexa.proxy.port && notifications.alexa.domain")
                  .row(v-if="notifications.alexa && notifications.alexa.active && notifications.alexa.proxy.port && notifications.alexa.domain")
                    .col-12
                      .d-block.float-right
                        b-icon.mr-2(
                          icon="check-circle-fill" 
                          variant="success"
                          v-if="alexaPing && !loadingAlexa"
                        )
                        b-icon.mr-2(
                          icon="exclamation-circle-fill" 
                          variant="danger"
                          v-if="!alexaPing && !loadingAlexa"
                        )
                        b-spinner.float-left.mt-3.mr-3.text-color-primary(type="grow" label="Loading..." small, v-if="loadingAlexa")
                        a.text-danger.alexaConnect(:href="`http://${alexaHost}:${notifications.alexa.proxy.port}`", @click.prevent="alexaReconnect" v-if="!loadingAlexa && !alexaPing") {{ $t("reconnect") }}
                        span.text-success(v-if="!loadingAlexa && alexaPing") {{ $t("connected") }}
        .col-12.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel(['settings:cameras:edit', 'settings:notifications:edit'])")
          b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.notifications.telegram.expand ? "180" : "-90"', @click="settingsLayout.notifications.telegram.expand = !settingsLayout.notifications.telegram.expand")
          h5.cursor-pointer.settings-box-top(@click="settingsLayout.notifications.telegram.expand = !settingsLayout.notifications.telegram.expand") {{ $t("telegram") }}
          b-collapse(
            v-model="settingsLayout.notifications.telegram.expand"
          )
            div.mt-2.mb-4
              .settings-box.container
                .row
                  .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                  .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="notifications.telegram.active"
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true",
                      :aria-expanded="notifications.telegram.active ? 'true' : 'false'"
                      aria-controls="telegram"
                    )
                b-collapse(
                  v-model="notifications.telegram.active"
                )
                  hr.hr-underline(v-if="notifications.telegram.active")
                  .row(v-if="notifications.telegram.active")
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("token") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                      b-form-input(
                        type='text',
                        :placeholder="$t('token')",
                        v-model="notifications.telegram.token"
                      )
                  hr.hr-underline(v-if="notifications.telegram.active")
                  .row(v-if="notifications.telegram.active")
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("chat_id") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                      b-form-input(
                        type='text',
                        :placeholder="$t('chat_id')",
                        v-model="notifications.telegram.chatID"
                      )
                  hr.hr-underline(v-if="notifications.telegram.active")
                  .row(v-if="notifications.telegram.active")
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("motion_message") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                      b-form-input(
                        type='text',
                        :placeholder="$t('motion_message')",
                        v-model="notifications.telegram.message"
                      )
                  hr.hr-underline(v-if="notifications.telegram.active")
                  div(v-if="notifications.telegram.active")
                    div(v-for="(camera, index) in cameras", :key="camera.name")
                      .row(:id='"telegramType" + index')
                        .col-12.d-flex.flex-wrap.align-content-center {{ camera.name }}
                        .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                          b-form-select(
                            v-model="camera.telegramType"
                            :options="telegramTypes"
                          )
                      hr.hr-underline
        .col-12.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel(['settings:cameras:edit', 'settings:notifications:edit'])")
          b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.notifications.webhook.expand ? "180" : "-90"', @click="settingsLayout.notifications.webhook.expand = !settingsLayout.notifications.webhook.expand")
          h5.cursor-pointer.settings-box-top(@click="settingsLayout.notifications.webhook.expand = !settingsLayout.notifications.webhook.expand") {{ $t("webhook") }}
          b-collapse(
            v-model="settingsLayout.notifications.webhook.expand"
          )
            div.mt-2.mb-4
              .settings-box.container
                .row
                  .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                  .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="notifications.webhook.active"
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true",
                      :aria-expanded="notifications.webhook.active ? 'true' : 'false'"
                      aria-controls="webhook"
                    )
                b-collapse(
                  v-model="notifications.webhook.active"
                )
                  hr.hr-underline
                  div
                    div(v-for="camera in cameras", :key="camera.name")
                      .row
                        .col-12.d-flex.flex-wrap.align-content-center {{ camera.name }}
                        .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                          b-form-input(
                            type='text',
                            placeholder="https://webhook.site/88e98f7e",
                            v-model="camera.webhookUrl"
                          )
                      hr.hr-underline
</template>

<script>
import { BIcon, BIconCheckCircleFill, BIconExclamationCircleFill, BIconTriangleFill } from 'bootstrap-vue';
import { ToggleButton } from 'vue-js-toggle-button';

import { getSetting, changeSetting } from '@/api/settings.api';
import localStorageMixin from '@/mixins/localstorage.mixin';

export default {
  name: 'SettingsNotifications',
  components: {
    BIcon,
    BIconCheckCircleFill,
    BIconExclamationCircleFill,
    BIconTriangleFill,
    ToggleButton,
  },
  mixins: [localStorageMixin],
  data() {
    return {
      alexaHost: window.location.hostname,
      alexaPing: false,
      alexaOptions: [
        { value: 'Enabled', text: this.$t('enabled') },
        { value: 'Disabled', text: this.$t('disabled') },
      ],
      cameras: [],
      camerasTimer: null,
      form: {
        snapshotTimer: 10,
      },
      notifications: {
        alexa: {},
        telegram: {},
        webhook: {},
      },
      recordings: {},
      notificationsTimer: null,
      loading: true,
      loadingAlexa: false,
      removeAfterTimer: [1, 3, 6, 12, 24],
      telegramTypes: [
        { value: 'Text', text: this.$t('text') },
        { value: 'Snapshot', text: this.$t('snapshot') },
        { value: 'Video', text: this.$t('video') },
        { value: 'Disabled', text: this.$t('disabled') },
      ],
    };
  },
  async mounted() {
    try {
      if (this.checkLevel('settings:notifications:access')) {
        const notifications = await getSetting('notifications');
        this.notifications = notifications.data;
      }

      if (this.checkLevel('settings:cameras:access')) {
        const cameras = await getSetting('cameras');
        this.cameras = cameras.data;
      }

      if (this.checkLevel('settings:recordings:access')) {
        const recordings = await getSetting('recordings');
        this.recordings = recordings.data;
      }

      this.$watch('cameras', this.camerasWatcher, { deep: true });
      this.$watch('notifications', this.notificationsWatcher, { deep: true });

      this.alexaActive();

      this.loading = false;
    } catch (err) {
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

        this.loadingAlexa = false;
      } catch (err) {
        this.loadingAlexa = false;
        this.$toast.error(err.message);
      }
    },
    async camerasWatcher(newValue) {
      this.$Progress.start();

      if (this.camerasTimer) {
        clearTimeout(this.camerasTimer);
        this.camerasTimer = null;
      }

      this.camerasTimer = setTimeout(async () => {
        try {
          await changeSetting('cameras', newValue, '?stopStream=true');
          this.$Progress.finish();
        } catch (error) {
          this.$toast.error(error.message);
          this.$Progress.fail();
        }
      }, 2000);
    },
    async notificationsWatcher(newValue) {
      this.$Progress.start();

      if (this.notificationsTimer) {
        clearTimeout(this.notificationsTimer);
        this.notificationsTimer = null;
      }

      const startTime = this.notifications.alexa.startTime || '00:00:00';
      const endTime = this.notifications.alexa.endTime || '23:59:00';

      if (startTime.split(':').length > 2) {
        this.notifications.alexa.startTime = startTime.split(':').slice(0, -1).join(':');
      }

      if (endTime.split(':').length > 2) {
        this.notifications.alexa.endTime = endTime.split(':').slice(0, -1).join(':');
      }

      this.notificationsTimer = setTimeout(async () => {
        try {
          await changeSetting('notifications', newValue);
          this.$Progress.finish();
        } catch (error) {
          this.$toast.error(error.message);
          this.$Progress.fail();
        }
      }, 2000);
    },
  },
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease-out;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

.alexaConnect {
}

.reconnect {
  margin-top: 13px;
  display: block;
  float: right;
}

.timePicker >>> .dropdown-menu {
  background: var(--secondary-bg-hover-color);
  border: 1px solid var(--third-bg-color);
  -webkit-box-shadow: 0px 0px 7px -2px rgb(0 0 0 / 50%);
  box-shadow: 0px 0px 7px -4px rgb(0 0 0 / 50%);
}

.timePicker >>> button {
  border-top-left-radius: 0px !important;
  border-bottom-left-radius: 0px !important;
}

.timePicker >>> .bi-chevron-up,
.timePicker >>> .bi-circle-fill {
  color: var(--primary-font-color) !important;
}

.timePicker >>> .form-control.focus {
  border-color: var(--trans-bg-color-3);
  box-shadow: 0 0 0 0.2rem var(--trans-bg-color-3);
}

.timePicker >>> .btn-secondary {
  background-color: var(--third-bg-color);
  color: var(--font-primary-color);
}
</style>
