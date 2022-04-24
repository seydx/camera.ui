<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-7.tw-mt-5(v-if="!loading")
    v-btn.save-btn(:class="fabAbove ? 'save-btn-top' : ''" v-scroll="onScroll" v-show="fab" color="success" transition="fade-transition" width="40" height="40" fab dark fixed bottom right @click="onSave" :loading="loadingProgress")
      v-icon {{ icons['mdiCheckBold'] }}

    .page-subtitle {{ $t('server') }}
    .page-subtitle-info {{ $t('server_information') }}

    .tw-flex.tw-justify-between.tw-items-center.tw-my-5
      label.form-input-label {{ $t('version') }}
      span.tw-text-right(:class="updateAvailable ? 'tw-text-red-500' : 'tw-text-green-500'") {{ updateAvailable ? $t('update_available') : $t('up_to_date') }}

    label.form-input-label {{ $t('update_or_downgrade') }}
    v-select(:loading="loadingNpm" :disabled="loadingNpm" :value="currentVersion" v-model="currentVersion" :items="availableVersions" prepend-inner-icon="mdi-npm" append-outer-icon="mdi-update" background-color="var(--cui-bg-card)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiNpm'] }}
      template(v-slot:append-outer)
        v-dialog(v-model="updateDialog" width="600" scrollable @click:outside="closeUpdateDialog" @keydown="closeUpdateDialog")
          template(v-slot:activator='{ on, attrs }')
            v-btn.tw-text-white(:disabled="loadingRestart || loadingReset || loadingSave|| loadingNpm" :loading="loadingUpdate" small fab style="margin-top: -8px" color="var(--cui-primary)")
              v-icon.tw-text-white(color="var(--cui-primary)" v-bind='attrs' v-on='on' @click="onBeforeUpdate") {{ icons['mdiUpdate'] }}
          v-card
            v-card-title {{ $t('release_notes') }}
            v-divider
            v-card-text.tw-p-7.text-default
              .tw-flex.tw-justify-center.tw-items-center.tw-w-full.tw-h-full(v-if="!changelog") 
                v-progress-circular(indeterminate color="var(--cui-primary)")
              vue-markdown.changelog(v-else) {{ changelog }}
            v-divider
            v-card-actions.tw-flex.tw-justify-end
              v-btn.text-default(text @click='closeUpdateDialog') {{ $t('cancel') }}
              v-btn(color='var(--cui-primary)' text @click='onUpdateRestart') {{ `${$t('update')} & ${$t('restart')}` }}

    v-dialog(v-model="restartDialog" width="500" scrollable)
      template(v-slot:activator='{ on, attrs }')
        v-btn.tw-text-white(:disabled="loadingRestart || loadingReset || loadingUpdate" block color="success" v-bind='attrs' v-on='on') {{ $t('restart') }}
      v-card
        v-card-title {{ $t('restart') }}
        v-divider
        v-card-text.tw-p-7.text-default.tw-text-center {{ $t('restart_confirm_text').replace('@', npmPackageName) }}
        v-divider
        v-card-actions.tw-flex.tw-justify-end
          v-btn.text-default(text @click='restartDialog = false') {{ $t('cancel') }}
          v-btn(color='var(--cui-primary)' text @click='onRestart') {{ $t('restart') }}

    v-dialog(v-model="resetDialog" width="500" scrollable)
      template(v-slot:activator='{ on, attrs }')
        v-btn.tw-text-white.tw-mt-2(:disabled="loadingRestart || loadingUpdate || loadingSave" :loading="loadingReset" block color="error" v-bind='attrs' v-on='on') {{ $t('reset') }}
      v-card
        v-card-title {{ $t('reset') }}
        v-divider
        v-card-text.tw-p-7.text-default.tw-text-center {{ $t('reset_confirm_text') }}
        v-divider
        v-card-actions.tw-flex.tw-justify-end
          v-btn.text-default(text @click='resetDialog = false') {{ $t('cancel') }}
          v-btn(color='var(--cui-primary)' text @click='onReset') {{ $t('reset') }}

    v-divider.tw-mt-6.tw-mb-8

    .page-subtitle.tw-mt-8 {{ $t('config') }}
    .page-subtitle-info {{ $t('config_information') }}

    .tw-flex.tw-justify-between.tw-items-center.tw-my-5
      label.form-input-label {{ $t('last_changed') }}
      span.tw-text-right.tw-text-green-500 {{ configFile.mtime }}

    v-btn.tw-text-white(:disabled="loadingRestart || loadingReset || loadingSave" :loading="loadingConfig" block color="success" @click="onDownloadConfig") {{ $t('download') }}

    v-divider.tw-mt-6.tw-mb-8

    .page-subtitle.tw-mt-8 {{ $t('database') }}
    .page-subtitle-info {{ $t('database_information') }}

    .tw-flex.tw-justify-between.tw-items-center.tw-my-5
      label.form-input-label {{ $t('last_updated') }}
      span.tw-text-right.tw-text-green-500 {{ dbFile.mtime }}

    v-btn.tw-text-white(:disabled="loadingRestart || loadingReset || loadingSave" :loading="loadingDb" block color="success" @click="onDownloadDb") {{ $t('download') }}

    v-divider.tw-mt-4.tw-mb-8

    v-expansion-panels(v-model="panel")
      v-expansion-panel
        v-expansion-panel-header
          div
            .page-subtitle {{ $t('interface') }}
            .page-subtitle-info {{ $t('interface_config') }}
        v-expansion-panel-content
          .tw-flex.tw-justify-between.tw-items-center(style="margin-top: -15px" v-if="npmPackageName === 'homebridge-camera-ui' || env === 'development'")
            label.form-input-label {{ $t('at_home_switch') }}
            v-switch(color="var(--cui-primary)" v-model="config.atHomeSwitch")
          
          label.form-input-label {{ $t('loglevel') }}
          v-select.select.tw-mb-2(hide-details prepend-inner-icon="mdi-door" v-model="config.logLevel" :items="logLevels" background-color="var(--cui-bg-card)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiConsole'] }}

          label.form-input-label {{ $t('port') }}
          v-text-field(hide-details v-model.number="config.port" type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiNumeric'] }}

      v-expansion-panel
        v-expansion-panel-header
          div
            .page-subtitle {{ $t('ssl') }}
            .page-subtitle-info {{ $t('ssl_config') }}
        v-expansion-panel-content
          label.form-input-label {{ $t('path_to_certificate') }}
          v-text-field.tw-mb-2(hide-details v-model="config.ssl.cert" prepend-inner-icon="mdi-at" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiAt'] }}

          label.form-input-label {{ $t('path_to_key') }}
          v-text-field(hide-details v-model="config.ssl.key" prepend-inner-icon="mdi-at" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiAt'] }}

      v-expansion-panel
        v-expansion-panel-header
          div
            .page-subtitle {{ $t('options') }}
            .page-subtitle-info {{ $t('video_processor_config') }}
        v-expansion-panel-content
          label.form-input-label {{ $t('video_processor_path') }}
          v-text-field(hide-details v-model="config.options.videoProcessor" prepend-inner-icon="mdi-at" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiAt'] }}
              
      v-expansion-panel
        v-expansion-panel-header
          div
            .page-subtitle {{ $t('http') }}
            .page-subtitle-info {{ $t('http_server_config') }}
        v-expansion-panel-content
          .tw-flex.tw-justify-between.tw-items-center
            label.form-input-label {{ $t('status') }}
            span.tw-text-right(:class="!httpStatus ? 'tw-text-red-500' : 'tw-text-green-500'") {{ httpStatus ? $t('online') : $t('offline') }}

          .tw-flex.tw-justify-between.tw-items-center
            label.form-input-label {{ $t('enabled') }}
            v-switch(color="var(--cui-primary)" v-model="config.http.active")

          .tw-flex.tw-justify-between.tw-items-center
            label.form-input-label {{ $t('localhost') }}
            v-switch(color="var(--cui-primary)" v-model="config.http.localHttp")

          label.form-input-label {{ $t('port') }}
          v-text-field(hide-details v-model.number="config.http.port" type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiNumeric'] }}

          v-btn.tw-text-white.tw-mb-3.tw-mt-5(:disabled="!httpStatus || loadingRestart" block color="error" @click="onRestartHttp(false)") {{ $t('stop') }}
          v-btn.tw-text-white(:disabled="!config.http.active || !config.http.port || loadingRestart || loadingSave" :loading="loadingRestartHttp" block color="success" @click="onRestartHttp(true)") {{ $t('restart') }}

      v-expansion-panel
        v-expansion-panel-header
          div
            .page-subtitle {{ $t('smtp') }}
            .page-subtitle-info {{ $t('smtp_server_config') }}
        v-expansion-panel-content
          .tw-flex.tw-justify-between.tw-items-center
            label.form-input-label {{ $t('status') }}
            span.tw-text-right(:class="!smtpStatus ? 'tw-text-red-500' : 'tw-text-green-500'") {{ smtpStatus ? $t('online') : $t('offline') }}

          .tw-flex.tw-justify-between.tw-items-center
            label.form-input-label {{ $t('enabled') }}
            v-switch(color="var(--cui-primary)" v-model="config.smtp.active")

          label.form-input-label {{ $t('port') }}
          v-text-field.tw-mb-2(hide-details v-model.number="config.smtp.port" type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiNumeric'] }}

          label.form-input-label {{ $t('space_replace') }}
          v-text-field(hide-details v-model="config.smtp.space_replace" prepend-inner-icon="mdi-find-replace" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiFindReplace'] }}

          v-btn.tw-text-white.tw-mb-3.tw-mt-5(:disabled="!smtpStatus || loadingRestart" block color="error" @click="onRestartSmtp(false)") {{ $t('stop') }}
          v-btn.tw-text-white(:disabled="!config.smtp.active || !config.smtp.port || loadingRestart || loadingSave" :loading="loadingRestartSmtp" block color="success" @click="onRestartSmtp(true)") {{ $t('restart') }}

      v-expansion-panel
        v-expansion-panel-header
          div
            .page-subtitle {{ $t('ftp') }}
            .page-subtitle-info {{ $t('ftp_server_config') }}
        v-expansion-panel-content
          .tw-flex.tw-justify-between.tw-items-center
            label.form-input-label {{ $t('status') }}
            span.tw-text-right(:class="!ftpStatus ? 'tw-text-red-500' : 'tw-text-green-500'") {{ ftpStatus ? $t('online') : $t('offline') }}

          .tw-flex.tw-justify-between.tw-items-center
            label.form-input-label {{ $t('enabled') }}
            v-switch(color="var(--cui-primary)" v-model="config.ftp.active")

          .tw-flex.tw-justify-between.tw-items-center
            label.form-input-label Use File
            v-switch(color="var(--cui-primary)" v-model="config.ftp.useFile")

          label.form-input-label {{ $t('port') }}
          v-text-field(hide-details v-model.number="config.ftp.port" type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiNumeric'] }}

          v-btn.tw-text-white.tw-mb-3.tw-mt-5(:disabled="!ftpStatus || loadingRestart" block color="error" @click="onRestartFtp(false)") {{ $t('stop') }}
          v-btn.tw-text-white(:disabled="!config.ftp.active || !config.ftp.port || loadingRestart || loadingSave" :loading="loadingRestartFtp" block color="success" @click="onRestartFtp(true)") {{ $t('restart') }}

      v-expansion-panel
        v-expansion-panel-header
          div
            .page-subtitle {{ $t('mqtt') }}
            .page-subtitle-info {{ $t('mqtt_config') }}
        v-expansion-panel-content
          .tw-flex.tw-justify-between.tw-items-center
            label.form-input-label {{ $t('status') }}
            span.tw-text-right(:class="!mqttStatus ? 'tw-text-red-500' : 'tw-text-green-500'") {{ mqttStatus ? $t('online') : $t('offline') }}

          .tw-flex.tw-justify-between.tw-items-center
            label.form-input-label {{ $t('enabled') }}
            v-switch(color="var(--cui-primary)" v-model="config.mqtt.active")

          label.form-input-label {{ $t('host') }}
          v-text-field.tw-mb-2(hide-details v-model="config.mqtt.host" prepend-inner-icon="mdi-web" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiWeb'] }}

          label.form-input-label {{ $t('port') }}
          v-text-field(hide-details v-model.number="config.mqtt.port" type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
            template(v-slot:prepend-inner)
              v-icon.text-muted {{ icons['mdiNumeric'] }}

          v-btn.tw-text-white.tw-mb-3.tw-mt-5(:disabled="!mqttStatus || loadingRestart" block color="error" @click="onRestartMqtt(false)") {{ $t('stop') }}
          v-btn.tw-text-white(:disabled="!config.mqtt.active || !config.mqtt.host || !config.mqtt.port || loadingRestart || loadingSave" :loading="loadingRestartMqtt" block color="success" @click="onRestartMqtt(true)") {{ $t('restart') }}

</template>

<script>
import compareVersions from 'compare-versions';
import VueMarkdown from 'vue-markdown';
import { mdiAt, mdiCheckBold, mdiConsole, mdiFindReplace, mdiNpm, mdiNumeric, mdiUpdate, mdiWeb } from '@mdi/js';

import { changeConfig, downloadConfig, getConfig, getConfigStat } from '@/api/config.api';
import {
  downloadDb,
  getChangelog,
  getDb,
  getPackage,
  restartFtp,
  restartHttp,
  restartMqtt,
  restartSmtp,
  restartSystem,
  stopFtp,
  stopHttp,
  stopMqtt,
  stopSmtp,
  updateSystem,
} from '@/api/system.api';
import { resetSettings } from '@/api/settings.api';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'SystemSettings',

  components: {
    VueMarkdown,
  },

  beforeRouteLeave(to, from, next) {
    if (this.loadingRestart || this.loadingUpdate || this.losdingReset) {
      return next(false);
    }

    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data: () => ({
    panel: [],

    icons: {
      mdiAt,
      mdiCheckBold,
      mdiConsole,
      mdiFindReplace,
      mdiNpm,
      mdiNumeric,
      mdiUpdate,
      mdiWeb,
    },

    fab: true,
    fabAbove: false,

    loading: true,
    loadingNpm: true,
    loadingProgress: true,
    loadingSave: false,
    loadingReset: false,
    loadingRestart: false,
    loadingUpdate: false,
    loadingConfig: false,
    loadingDb: false,
    loadingRestartFtp: false,
    loadingRestartHttp: false,
    loadingRestartMqtt: false,
    loadingRestartSmtp: false,

    resetDialog: false,
    restartDialog: false,
    updateDialog: false,

    availableVersions: [],
    changelog: '',
    config: {},
    configTimeout: null,
    currentVersion: null,
    configFile: {},
    dbFile: {},
    env: '',
    latestVersion: null,
    serviceMode: false,
    updateAvailable: false,
    npmPackageName: 'camera.ui',
    logLevels: ['info', 'debug', 'warn', 'error'],

    ftpStatus: false,
    httpStatus: false,
    mqttStatus: false,
    smtpStatus: false,
  }),

  async created() {
    this.$socket.client.on('ftpStatus', this.getFtpStatus);
    this.$socket.client.emit('getFtpStatus');

    this.$socket.client.on('httpStatus', this.getHttpStatus);
    this.$socket.client.emit('getHttpStatus');

    this.$socket.client.on('mqttStatus', this.getMqttStatus);
    this.$socket.client.emit('getMqttStatus');

    this.$socket.client.on('smtpStatus', this.getSmtpStatus);
    this.$socket.client.emit('getSmtpStatus');

    this.$socket.client.on('motionServerStatus', this.getMotionServerStatus);
    this.$socket.client.emit('getMotionServerStatus');

    try {
      this.env = process.env.NODE_ENV;

      const config = await getConfig('?target=config');
      const configFile = await getConfigStat();
      const dbFile = await getDb();

      this.configFile = configFile.data;
      this.dbFile = dbFile.data;

      if (this.dbFile?.mtime) {
        let time = new Date(this.dbFile.mtime);
        this.dbFile.mtime = `${time.toLocaleDateString()}, ${time.toLocaleTimeString()}`;
      }

      if (this.configFile?.mtime) {
        let time = new Date(this.configFile.mtime);
        this.configFile.mtime = `${time.toLocaleDateString()}, ${time.toLocaleTimeString()}`;
      }

      this.serviceMode = config.data.serviceMode;
      this.currentVersion = config.data.version;

      this.config = {
        port: config.data.port || window.location.port || 80,
        atHomeSwitch: config.data.atHomeSwitch || false,
        logLevel: config.data.logLevel || 'info',
        ssl: config.data.ssl || {
          key: '',
          cert: '',
        },
        http: config.data.http || {
          active: false,
          localhttp: false,
          port: 7272,
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
        ftp: config.data.ftp || {
          active: false,
          port: 5050,
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

      this.loading = false;
      this.loadingProgress = false;

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
      this.latestVersion = relatedVersions[0].value || relatedVersions[0];
      this.updateAvailable = compareVersions.compare(this.latestVersion, this.currentVersion, '>');

      //this.$watch('config', this.configWatcher, { deep: true });

      //this.loading = false;
      //this.loadingProgress = false;

      this.loadingNpm = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    this.$socket.client.off('ftpStatus', this.getFtpStatus);
    this.$socket.client.off('httpStatus', this.getHttpStatus);
    this.$socket.client.off('mqttStatus', this.getMqttStatus);
    this.$socket.client.off('smtpStatus', this.getSmtpStatus);
    this.$socket.client.off('motionServerStatus', this.getMotionServerStatus);
  },

  methods: {
    closeUpdateDialog(e) {
      if (e && e.constructor.name === 'KeyboardEvent') {
        if (e.key !== 'Escape' && e.keyCode !== 27) {
          return;
        }
      }

      this.updateDialog = false;
      this.changelog = '';
    },
    /*async configWatcher() {
      if (this.loadingSave) {
        return;
      }

      this.loadingSave = true;
      this.loadingProgress = true;

      if (this.configTimeout) {
        clearTimeout(this.configTimeout);
        this.configTimeout = null;
      }

      this.configTimeout = setTimeout(async () => {
        try {
          await changeConfig(this.config);
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }

        this.loadingSave = false;
        this.loadingProgress = false;
      }, 2000);
    },*/
    getFtpStatus(data) {
      this.ftpStatus = data.status === 'online';
    },
    getHttpStatus(data) {
      this.httpStatus = data.status === 'online';
    },
    getMotionServerStatus(data) {
      this.ftpStatus = data.ftpStatus === 'online';
      this.httpStatus = data.httpStatus === 'online';
      this.mqttStatus = data.mqttStatus === 'online';
      this.smtpStatus = data.smtpStatus === 'online';
    },
    getMqttStatus(data) {
      this.mqttStatus = data.status === 'online';
    },
    getSmtpStatus(data) {
      this.smtpStatus = data.status === 'online';
    },
    async onBeforeUpdate() {
      try {
        const response = await getChangelog(`?version=${this.currentVersion}`);
        this.changelog = response.data;
      } catch (err) {
        console.log(err);
        this.$toast.error(err);
      }
    },
    async onDownloadConfig() {
      if (this.loadingConfig) {
        return;
      }

      this.loadingProgress = true;
      this.loadingConfig = true;

      try {
        const response = await downloadConfig();
        const url = window.URL.createObjectURL(new Blob([JSON.stringify(response.data)], { type: 'text/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'camera.ui.config.json');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingProgress = false;
      this.loadingConfig = false;
    },
    async onDownloadDb() {
      if (this.loadingDb) {
        return;
      }

      this.loadingProgress = true;
      this.loadingDb = true;

      try {
        const response = await downloadDb();
        const url = window.URL.createObjectURL(new Blob([JSON.stringify(response.data)], { type: 'text/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'camera.ui.database.json');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingProgress = false;
      this.loadingDb = false;
    },
    async onReset() {
      this.resetDialog = false;

      if (this.loadingReset) {
        return;
      }

      this.loadingProgress = true;
      this.loadingReset = true;

      try {
        await resetSettings();
        this.$toast.success(this.$t('database_resetted'));

        await this.$store.dispatch('auth/logout');
        setTimeout(() => this.$router.push('/'), 200);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);

        this.loadingReset = false;
        this.loadingProgress = false;
      }
    },
    async onRestart() {
      this.restartDialog = false;

      if (this.loadingRestart) {
        return;
      }

      this.loadingProgress = true;
      this.loadingRestart = true;

      //this.$toast.success(this.$t('system_restart_initiated'));

      try {
        await restartSystem();
        localStorage.setItem('restarted', true);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);

        this.loadingRestart = false;
        this.loadingProgress = false;
      }
    },
    async onRestartFtp(restart) {
      if (this.loadingRestartFtp) {
        return;
      }

      this.loadingProgress = true;
      this.loadingRestartFtp = true;

      try {
        if (restart) {
          await restartFtp();
        } else {
          await stopFtp();
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingRestartFtp = false;
      this.loadingProgress = false;
    },
    async onRestartHttp(restart) {
      if (this.loadingRestartHttp) {
        return;
      }

      this.loadingProgress = true;
      this.loadingRestartHttp = true;

      try {
        if (restart) {
          await restartHttp();
        } else {
          await stopHttp();
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingProgress = false;
      this.loadingRestartHttp = false;
    },
    async onRestartMqtt(restart) {
      if (this.loadingRestartMqtt) {
        return;
      }

      this.loadingProgress = true;
      this.loadingRestartMqtt = true;

      try {
        if (restart) {
          await restartMqtt();
        } else {
          await stopMqtt();
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingProgress = false;
      this.loadingRestartMqtt = false;
    },
    async onRestartSmtp(restart) {
      if (this.loadingRestartSmtp) {
        return;
      }

      this.loadingProgress = true;
      this.loadingRestartSmtp = true;

      try {
        if (restart) {
          await restartSmtp();
        } else {
          await stopSmtp();
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingProgress = false;
      this.loadingRestartSmtp = false;
    },
    async onSave() {
      if (this.loadingSave) {
        return;
      }

      this.loadingProgress = true;
      this.loadingSave = true;

      try {
        await changeConfig(this.config);
        this.$toast.success(this.$t('config_was_saved'));
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingSave = false;
      this.loadingProgress = false;
    },
    onScroll(e) {
      if (typeof window === 'undefined') {
        this.fabAbove = true;
        return;
      }

      const top = window.pageYOffset || e.target.scrollTop || 0;
      this.fabAbove = top > 20;
    },
    async onUpdateRestart() {
      this.updateDialog = false;

      if (this.loadingUpdate) {
        return;
      }

      this.loadingProgress = true;
      this.loadingUpdate = true;

      try {
        this.$toast.success(this.$t('system_update_initiated'));
        await updateSystem(`?version=${this.currentVersion}`);
        localStorage.setItem('updated', true);
        //this.$toast.success(this.$t('system_successfully_updated'));

        await timeout(500);

        this.$toast.success(this.$t('system_restart_initiated'));
        this.loadingRestart = true;
        await restartSystem();
        localStorage.setItem('restarted', true);
        //this.$toast.success(this.$t('system_successfully_restarted'));

        await timeout(500);

        this.updateAvailable = false;
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);

        this.loadingProgress = false;
        this.loadingUpdate = false;
        this.loadingRestart = false;
      }
    },
  },
};
</script>

<style scoped>
.save-btn {
  right: 30px !important;
  bottom: 45px !important;
  z-index: 11 !important;
  transition: 0.3s all;
}

.save-btn-top {
  bottom: 95px !important;
}

.changelog >>> a {
  color: var(--cui-primary);
  text-decoration: none;
  font-weight: 600;
}

.changelog >>> h1 {
  line-height: 2;
}

.changelog >>> h2 {
  line-height: 3;
}

.changelog >>> hr {
  margin-bottom: 16px;
}

.changelog >>> code {
  background-color: rgba(var(--cui-primary-rgb), 0.5);
  color: #fff;
}

.changelog >>> ul {
  margin-bottom: 16px;
}

div >>> .v-expansion-panels .v-expansion-panel {
  background: none;
  color: var(--cui-text-default);
  border-bottom: 1px solid rgba(var(--cui-text-default-rgb), 0.12);
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

div >>> .v-expansion-panel-header {
  padding-left: 0;
  padding-right: 0;
}

div >>> .v-expansion-panel-content__wrap {
  padding-left: 0;
  padding-right: 0;
}

div >>> .v-expansion-panel::before {
  box-shadow: unset;
}

div >>> .theme--light.v-expansion-panels .v-expansion-panel-header .v-expansion-panel-header__icon .v-icon {
  color: rgba(var(--cui-text-default-rgb), 0.4);
}

div >>> .v-expansion-panel:not(:first-child)::after {
  border: none;
}

div >>> .v-expansion-panels > *:last-child {
  border: none !important;
}

div >>> .v-expansion-panel-header {
  line-height: unset !important;
}
</style>
