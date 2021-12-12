<template lang="pug">
.w-100.h-100
  vue-progress-bar
  .loader-bg(v-if="loadingRestart")
    .loader
  .d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
    b-spinner.text-color-primary
  transition-group(name="fade", mode="out-in", v-if="loading")
  transition-group(name="fade", mode="out-in", v-else)
    .d-flex.flex-wrap.justify-content-between(key="loaded")
      .col-12.px-0(v-if="checkLevel('admin')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.system.server.expand ? "180" : "-90"', @click="settingsLayout.system.server.expand = !settingsLayout.system.server.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.system.server.expand = !settingsLayout.system.server.expand") {{ $t("server") }}
        b-collapse(
          v-model="settingsLayout.system.server.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("status") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  .d-block.w-100.text-right.mb-2(:class="updateAvailable ? 'text-danger' : 'text-success'") {{ updateAvailable ? $t('update_available') : $t('up_to_date') }}
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("version") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-select.versionSelect(v-model="currentVersion" :options="availableVersions")
              b-button#updateButton.w-100.updateButton.mt-4(v-b-modal.updateModal @click="onBeforeUpdate" :class="loadingUpdate || loadingRestart ? 'btnError' : 'btnNoError'" :disabled="loadingUpdate || loadingRestart") 
                span(v-if="loadingUpdate") 
                  b-spinner(style="color: #fff" type="grow" small)
                span(v-else) {{ `${$t('update')} & ${$t('restart')}` }}
              b-modal#updateModal.updateModal(
                centered
                scrollable
                ref="updateModal"
                :title="$t('release_notes')",
                :cancel-title="$t('cancel')",
                :ok-title="`${$t('update')} & ${$t('restart')}`",
                ok-variant="primary",
                size="lg"
                @ok="onUpdate"
              )
                b-spinner.text-color-primary.d-block.mx-auto(v-if="!changelog", style="position: relative; top: calc(50% - 16px)")
                vue-markdown.changelog(v-else) {{ changelog }}
      .col-12.px-0.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel('admin')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.system.interface.expand ? "180" : "-90"', @click="settingsLayout.system.interface.expand = !settingsLayout.system.interface.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.system.interface.expand = !settingsLayout.system.interface.expand") {{ $t('interface') }}
        b-collapse(
          v-model="settingsLayout.system.interface.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("status") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  .d-block.w-100.text-right.mb-2.text-success {{ $t('online') }}
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("port") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-input(
                    type='number',
                    placeholder=3333,
                    v-model="config.port"
                    number
                  )
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("path_to_certificate") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-input(
                    type='text',
                    v-model="config.ssl.cert"
                  )
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("path_to_key") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-input(
                    type='text',
                    v-model="config.ssl.key"
                  )
              hr.hr-underline
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("debug") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="config.debug"
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    :aria-expanded="config.debug ? 'true' : 'false'"
                    aria-controls="debug"
                  )
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("language") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-select(
                    v-model="config.language"
                    :options="languages"
                  )
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("theme") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-select(
                    v-model="config.theme"
                    :options="themes"
                  )
              hr.hr-underline
              b-button#restartButton.w-100.restartButton.mt-2(v-b-modal.restartModal :class="loadingRestart || loadingUpdate ? 'btnError' : 'btnNoError'" :disabled="loadingRestart || loadingUpdate") 
                span(v-if="loadingRestart") 
                  b-spinner(style="color: #fff" type="grow" small)
                span(v-else) {{ $t('save') + ' & ' + $t('restart') }}
              b-modal#restartModal.restartModal(
                centered
                scrollable
                ref="restartModal"
                :title="$t('restart_confirm')",
                :cancel-title="$t('cancel')",
                :ok-title="$t('restart')",
                ok-variant="primary",
                size="sm"
                @ok="onRestart"
              )
                .w-100.text-center {{ $t('restart_confirm_text').replace('@', npmPackageName) }}
      .col-12.px-0.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel('admin')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.system.http.expand ? "180" : "-90"', @click="settingsLayout.system.http.expand = !settingsLayout.system.http.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.system.http.expand = !settingsLayout.system.http.expand") {{ $t('http') }}
        b-collapse(
          v-model="settingsLayout.system.http.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("status") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  .d-block.w-100.text-right.mb-2.text-success {{ $t('online') }}
              hr.hr-underline
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="config.http.active"
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    :aria-expanded="config.http.active ? 'true' : 'false'"
                    aria-controls="http"
                  )
              hr.hr-underline
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("localhttp") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="config.http.localhttp"
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    :aria-expanded="config.http.localhttp ? 'true' : 'false'"
                    aria-controls="localhttp"
                  )
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("port") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-input(
                    type='number',
                    placeholder=7272,
                    v-model="config.http.port"
                    number
                  )
              hr.hr-underline
              b-button#restartHttpButton.w-100.restartButton.mt-4(@click="saveRestartHttp" :class="loadingRestart || loadingHttpRestart ? 'btnError' : 'btnNoError'" :disabled="loadingRestart || loadingHttpRestart") 
                span(v-if="loadingRestart || loadingHttpRestart") 
                  b-spinner(style="color: #fff" type="grow" small)
                span(v-else) {{ $t('save') + ' & ' + $t('restart') }}
      .col-12.px-0.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel('admin')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.system.mqtt.expand ? "180" : "-90"', @click="settingsLayout.system.mqtt.expand = !settingsLayout.system.mqtt.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.system.mqtt.expand = !settingsLayout.system.mqtt.expand") {{ $t('mqtt') }}
        b-collapse(
          v-model="settingsLayout.system.mqtt.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("status") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  .d-block.w-100.text-right.mb-2.text-success {{ $t('online') }}
              hr.hr-underline
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="config.mqtt.active"
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    :aria-expanded="config.mqtt.active ? 'true' : 'false'"
                    aria-controls="mqtt"
                  )
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("host") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-input(
                    type='text',
                    v-model="config.mqtt.host"
                  )
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("port") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-input(
                    type='number',
                    placeholder=1883,
                    v-model="config.mqtt.port"
                    number
                  )
              b-button#restartMqttButton.w-100.restartButton.mt-4(@click="saveRestartMqtt" :class="loadingRestart || loadingMqttRestart ? 'btnError' : 'btnNoError'" :disabled="loadingRestart || loadingMqttRestart") 
                span(v-if="loadingRestart || loadingMqttRestart") 
                  b-spinner(style="color: #fff" type="grow" small)
                span(v-else) {{ $t('save') + ' & ' + $t('restart') }}
      .col-12.px-0.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel('admin')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.system.smtp.expand ? "180" : "-90"', @click="settingsLayout.system.smtp.expand = !settingsLayout.system.smtp.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.system.smtp.expand = !settingsLayout.system.smtp.expand") {{ $t('smtp') }}
        b-collapse(
          v-model="settingsLayout.system.smtp.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("status") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  .d-block.w-100.text-right.mb-2.text-success {{ $t('online') }}
              hr.hr-underline
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="config.smtp.active"
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    :aria-expanded="config.smtp.active ? 'true' : 'false'"
                    aria-controls="smtp"
                  )
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("port") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-input(
                    type='number',
                    placeholder=7272,
                    v-model="config.smtp.port"
                    number
                  )
              hr.hr-underline
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("space_replace") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                  b-form-input(
                    type='text',
                    placeholder="+",
                    v-model="config.smtp.space_replace"
                  )
              b-button#restartSmtpButton.w-100.restartButton.mt-4(@click="saveRestartSmtp" :class="loadingRestart || loadingSmtpRestart ? 'btnError' : 'btnNoError'" :disabled="loadingRestart || loadingSmtpRestart") 
                span(v-if="loadingRestart || loadingSmtpRestart") 
                  b-spinner(style="color: #fff" type="grow" small)
                span(v-else) {{ $t('save') + ' & ' + $t('restart') }}
</template>

<script>
import { BIcon, BIconTriangleFill } from 'bootstrap-vue';
import compareVersions from 'compare-versions';
import { ToggleButton } from 'vue-js-toggle-button';
import VueMarkdown from 'vue-markdown';

import { changeConfig, getConfig } from '@/api/config.api';
import { getChangelog, getPackage, restartSystem, updateSystem } from '@/api/system.api';

import localStorageMixin from '@/mixins/localstorage.mixin';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'SettingsConfig',
  components: {
    BIcon,
    BIconTriangleFill,
    ToggleButton,
    VueMarkdown,
  },
  mixins: [localStorageMixin],
  data() {
    return {
      availableVersions: [],
      changelog: '',
      config: {},
      configTimer: null,
      currentVersion: null,
      error: false,
      languages: [
        { value: 'auto', text: this.$t('auto') },
        { value: 'de', text: this.$t('lang_german') },
        { value: 'en', text: this.$t('lang_english') },
        { value: 'nl', text: this.$t('lang_dutch') },
      ],
      latestVersion: null,
      loading: true,
      loadingSave: false,
      loadingRestart: false,
      loadingHttpRestart: false,
      loadingMqttRestart: false,
      loadingSmtpRestart: false,
      loadingUpdate: false,
      npmPackageName: 'camera.ui',
      serviceMode: false,
      themes: [
        { value: 'auto', text: this.$t('auto') },
        { value: 'light-pink', text: `${this.$t('light')} - ${this.$t('pink')}` },
        { value: 'light-blue', text: `${this.$t('light')} - ${this.$t('blue')}` },
        { value: 'light-blgray', text: `${this.$t('light')} - ${this.$t('blue_gray')}` },
        { value: 'light-brown', text: `${this.$t('light')} - ${this.$t('brown')}` },
        { value: 'light-orange', text: `${this.$t('light')} - ${this.$t('orange')}` },
        { value: 'light-purple', text: `${this.$t('light')} - ${this.$t('purple')}` },
        { value: 'light-yellow', text: `${this.$t('light')} - ${this.$t('yellow')}` },
        { value: 'light-green', text: `${this.$t('light')} - ${this.$t('green')}` },
        { value: 'light-gray', text: `${this.$t('light')} - ${this.$t('gray')}` },
        { value: 'dark-pink', text: `${this.$t('dark')} - ${this.$t('pink')}` },
        { value: 'dark-blue', text: `${this.$t('dark')} - ${this.$t('blue')}` },
        { value: 'dark-blgray', text: `${this.$t('dark')} - ${this.$t('blue_gray')}` },
        { value: 'dark-brown', text: `${this.$t('dark')} - ${this.$t('brown')}` },
        { value: 'dark-orange', text: `${this.$t('dark')} - ${this.$t('orange')}` },
        { value: 'dark-purple', text: `${this.$t('dark')} - ${this.$t('purple')}` },
        { value: 'dark-yellow', text: `${this.$t('dark')} - ${this.$t('yellow')}` },
        { value: 'dark-green', text: `${this.$t('dark')} - ${this.$t('green')}` },
        { value: 'dark-gray', text: `${this.$t('dark')} - ${this.$t('gray')}` },
      ],
      updateAvailable: false,
    };
  },
  async created() {
    try {
      const config = await getConfig('?target=config');

      this.serviceMode = config.data.serviceMode;
      this.currentVersion = config.data.version;

      //remove not used params from config editor
      delete config.timestamp;
      delete config.platform;
      delete config.node;
      delete config.version;
      delete config.firstStart;
      delete config.mqttConfigs;
      delete config.serviceMode;

      this.config = {
        port: config.data.port || window.location.port || 80,
        debug: config.data.debug || false,
        language: config.data.language || 'auto',
        theme: config.data.theme || 'auto',
        ssl: config.data.ssl || {
          key: '',
          cert: '',
        },
        http: config.data.http || {
          active: false,
          localhttp: false,
          port: 7575,
        },
        mqtt: config.data.mqtt || {
          active: false,
          host: '',
          port: 1883,
        },
        smtp: config.data.smtp || {
          active: false,
          port: 2525,
          space_replace: '+',
        },
        options: config.data.options || {
          videoProcessor: 'ffmpeg',
        },
        cameras: config.data.cameras || [],
      };

      let currentDistTag = this.currentVersion.split('-')[1];

      if (!currentDistTag) {
        currentDistTag = 'latest';
      } else {
        currentDistTag = currentDistTag.split('.')[0];
      }

      const pkg = await getPackage();
      const distTags = pkg.data['dist-tags'];
      const versions = Object.keys(pkg.data.versions).reverse();

      versions.forEach((version) => {
        let versionDistTag = version.split('-')[1];

        if (versionDistTag) {
          //alpha,beta,test
          versionDistTag = versionDistTag.split('.')[0];

          const distTagExist = this.availableVersions.some((v) => {
            let vDistTag = (v.value ? v.value : v).split('-')[1];

            if (vDistTag) {
              vDistTag = vDistTag.split('.')[0];

              if (vDistTag === versionDistTag) {
                return true;
              }
            }
          });

          if (!distTagExist) {
            this.availableVersions.push(version);
          }
        } else {
          //latest
          if (version === distTags.latest) {
            this.availableVersions.push({ value: version, text: `${version}-latest` });
            const versionExist = this.availableVersions.some((v) => (v.value || v) === this.currentVersion);

            if (version !== this.currentVersion && !versionExist) {
              this.availableVersions.push(this.currentVersion);
            }
          } else {
            this.availableVersions.push(version);
          }
        }
      });

      const relatedVersions = this.availableVersions.filter((version) => {
        const v = version.value ? version.value : version;

        if (currentDistTag !== 'latest' && v.includes(currentDistTag)) {
          return version;
        } else if (currentDistTag === 'latest' && !v.includes('-')) {
          return version;
        }
      });

      this.npmPackageName = pkg.data.name;
      this.latestVersion = relatedVersions[0];
      this.updateAvailable = compareVersions.compare(this.latestVersion, this.currentVersion, '>');

      //this.$watch('config', this.configWatcher, { deep: true });

      this.loading = false;
    } catch (err) {
      console.log(err.message);
      this.$toast.error(err.message);
    }
  },
  methods: {
    async configWatcher(newValue) {
      this.$Progress.start();

      if (this.configTimer) {
        clearTimeout(this.configTimer);
        this.configTimer = null;
      }

      this.configTimer = setTimeout(async () => {
        try {
          await changeConfig(newValue);
          this.$Progress.finish();
        } catch (error) {
          this.$toast.error(error.message);
          this.$Progress.fail();
        }
      }, 2000);
    },
    async onSave() {
      const saveButton = document.getElementById('saveButton');
      saveButton.blur();

      if (this.loadingSave || this.loadingRestart) {
        return;
      }

      this.$Progress.start();
      this.loadingSave = true;

      try {
        await changeConfig(this.config);
        this.$Progress.finish();
        this.loadingSave = false;
        this.$toast.success(this.$t('config_was_saved'));
      } catch (error) {
        this.$toast.error(error.message);
        this.$Progress.fail();
        this.loadingSave = false;
      }
    },
    async onRestart() {
      const restartButton = document.getElementById('restartButton');
      restartButton.blur();

      if (this.loadingRestart) {
        return;
      }

      this.loadingRestart = true;

      //this.$toast.success(this.$t('system_restart_initiated'));

      try {
        await restartSystem();
        localStorage.setItem('restarted', true);
      } catch (error) {
        this.$toast.error(error.message);
        this.loadingRestart = false;
      }
    },
    async onBeforeUpdate() {
      const response = await getChangelog(`?version=${this.currentVersion}`);
      this.changelog = response.data;
    },
    async onUpdate() {
      const restartButton = document.getElementById('restartButton');
      restartButton.blur();

      const updateButton = document.getElementById('updateButton');
      updateButton.blur();

      if (this.loadingUpdate || this.loadingRestart) {
        return;
      }

      this.loadingUpdate = true;
      this.loadingRestart = true;

      try {
        this.$toast.success(this.$t('system_update_initiated'));
        await updateSystem(`?version=${this.currentVersion}`);
        localStorage.setItem('updated', true);
        //this.$toast.success(this.$t('system_successfully_updated'));

        await timeout(500);

        this.$toast.success(this.$t('system_restart_initiated'));
        await restartSystem();
        localStorage.setItem('restarted', true);
        //this.$toast.success(this.$t('system_successfully_restarted'));

        await timeout(500);

        this.updateAvailable = false;
      } catch (error) {
        this.$toast.error(error.message);
        this.loadingUpdate = false;
        this.loadingRestart = false;
      }
    },
    async saveRestartInterface() {
      const saveButton = document.getElementById('saveButton');
      saveButton.blur();

      if (this.loadingSave || this.loadingRestart) {
        return;
      }

      this.$Progress.start();
      this.loadingSave = true;

      try {
        await changeConfig(this.config);
        this.$Progress.finish();
        this.loadingSave = false;
        this.$toast.success(this.$t('config_was_saved'));
      } catch (error) {
        this.$toast.error(error.message);
        this.$Progress.fail();
        this.loadingSave = false;
      }
    },
    async saveRestartHttp() {
      const restartButton = document.getElementById('restartHttpButton');
      restartButton.blur();

      if (this.loadingHttpRestart || this.loadingRestart) {
        return;
      }

      this.$Progress.start();
      this.loadingHttpRestart = true;

      try {
        await changeConfig(this.config.http, 'http');

        this.$Progress.finish();
        this.$toast.success(this.$t('success'));
        this.loadingHttpRestart = false;
      } catch (error) {
        this.$Progress.fail();
        this.$toast.error(error.message);
        this.loadingHttpRestart = false;
      }
    },
    async saveRestartMqtt() {
      const restartButton = document.getElementById('restartMqttButton');
      restartButton.blur();

      if (this.loadingMqttRestart || this.loadingRestart) {
        return;
      }

      this.$Progress.start();
      this.loadingMqttRestart = true;

      try {
        await changeConfig(this.config.mqtt, 'mqtt');

        this.$Progress.finish();
        this.$toast.success(this.$t('success'));
        this.loadingMqttRestart = false;
      } catch (error) {
        this.$Progress.fail();
        this.$toast.error(error.message);
        this.loadingMqttRestart = false;
      }
    },
    async saveRestartSmtp() {
      const restartButton = document.getElementById('restartSmtpButton');
      restartButton.blur();

      if (this.loadingSmtpRestart || this.loadingRestart) {
        return;
      }

      this.$Progress.start();
      this.loadingSmtpRestart = true;

      try {
        await changeConfig(this.config.smtp, 'smtp');

        this.$Progress.finish();
        this.$toast.success(this.$t('success'));
        this.loadingSmtpRestart = false;
      } catch (error) {
        this.$Progress.fail();
        this.$toast.error(error.message);
        this.loadingSmtpRestart = false;
      }
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

.card {
  background-color: var(--third-bg-color);
  color: var(--primary-font-color);
}

.btnError {
  background: #5e5e5e;
  cursor: not-allowed;
}

.btnNoError {
  background: var(--primary-color) !important;
}

.btnNoError:hover,
.btnNoError:focus,
.btnNoError:active {
  background: var(--secondary-color) !important;
}

.restartButton,
.updateButton,
.saveButton {
  height: 40px;
  transition: 0.3s all;
}

select .versionSelect {
  text-align: center;
  text-align-last: center;
  -moz-text-align-last: center;
}

.loader-bg {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--primary-bg-color);
  z-index: 9999;
}

.loader {
  color: var(--primary-color);
  font-size: 90px;
  text-indent: -9999em;
  overflow: hidden;
  width: 1em;
  height: 1em;
  border-radius: 50%;
  margin: 72px auto;
  position: relative;
  -webkit-transform: translateZ(0);
  -ms-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-animation: load6 1.7s infinite ease, round 1.7s infinite ease;
  animation: load6 1.7s infinite ease, round 1.7s infinite ease;
  top: calc(50% - 1em);
}
@-webkit-keyframes load6 {
  0% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
  5%,
  95% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
  10%,
  59% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.087em -0.825em 0 -0.42em, -0.173em -0.812em 0 -0.44em,
      -0.256em -0.789em 0 -0.46em, -0.297em -0.775em 0 -0.477em;
  }
  20% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.338em -0.758em 0 -0.42em, -0.555em -0.617em 0 -0.44em,
      -0.671em -0.488em 0 -0.46em, -0.749em -0.34em 0 -0.477em;
  }
  38% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.377em -0.74em 0 -0.42em, -0.645em -0.522em 0 -0.44em, -0.775em -0.297em 0 -0.46em,
      -0.82em -0.09em 0 -0.477em;
  }
  100% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
}
@keyframes load6 {
  0% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
  5%,
  95% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
  10%,
  59% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.087em -0.825em 0 -0.42em, -0.173em -0.812em 0 -0.44em,
      -0.256em -0.789em 0 -0.46em, -0.297em -0.775em 0 -0.477em;
  }
  20% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.338em -0.758em 0 -0.42em, -0.555em -0.617em 0 -0.44em,
      -0.671em -0.488em 0 -0.46em, -0.749em -0.34em 0 -0.477em;
  }
  38% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.377em -0.74em 0 -0.42em, -0.645em -0.522em 0 -0.44em, -0.775em -0.297em 0 -0.46em,
      -0.82em -0.09em 0 -0.477em;
  }
  100% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
}
@-webkit-keyframes round {
  0% {
    -webkit-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
@keyframes round {
  0% {
    -webkit-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
.changelog >>> a {
  color: var(--primary-color);
}
</style>
