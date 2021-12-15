<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-7(v-if="!loading")
    .page-subtitle.tw-mt-8 {{ $t('server') }}
    .page-subtitle-info {{ $t('server_information') }}

    .tw-flex.tw-justify-between.tw-items-center.tw-my-5
      label.form-input-label {{ $t('version') }}
      span.tw-text-right(:class="updateAvailable ? 'tw-text-red-500' : 'tw-text-green-500'") {{ updateAvailable ? $t('update_available') : $t('up_to_date') }}

    label.form-input-label {{ $t('update_or_downgrade') }}
    v-select(:value="currentVersion" v-model="currentVersion" :items="availableVersions" prepend-inner-icon="mdi-npm" append-outer-icon="mdi-update" background-color="var(--cui-bg-card)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiNpm'] }}
      template(v-slot:append-outer)
        v-dialog(v-model="updateDialog" width="500" scrollable @click:outside="closeUpdateDialog" @keydown="closeUpdateDialog")
          template(v-slot:activator='{ on, attrs }')
            v-btn.tw-text-white(:loading="loadingUpdate" small fab style="margin-top: -8px" color="var(--cui-primary)")
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
        v-btn.tw-text-white(:loading="loadingRestart" block color="red" v-bind='attrs' v-on='on') {{ $t('restart') }}
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
        v-btn.tw-text-white.tw-mt-2(:loading="loadingReset" block color="red" v-bind='attrs' v-on='on') {{ $t('reset') }}
      v-card
        v-card-title {{ $t('reset') }}
        v-divider
        v-card-text.tw-p-7.text-default.tw-text-center {{ $t('reset_confirm_text') }}
        v-divider
        v-card-actions.tw-flex.tw-justify-end
          v-btn.text-default(text @click='resetDialog = false') {{ $t('cancel') }}
          v-btn(color='var(--cui-primary)' text @click='onReset') {{ $t('reset') }}

    v-divider.tw-mt-6.tw-mb-8

    .page-subtitle.tw-mt-8 {{ $t('database') }}
    .page-subtitle-info {{ $t('database_information') }}

    .tw-flex.tw-justify-between.tw-items-center.tw-my-5
      label.form-input-label {{ $t('last_updated') }}
      span.tw-text-right.tw-text-green-500 {{ dbFile.mtime }}

    v-btn.tw-text-white(:loading="loadingDb" block color="success" @click="onDownloadDb") {{ $t('download') }}

    v-divider.tw-mt-4.tw-mb-8
    
    .page-subtitle.tw-mt-8 {{ $t('interface') }}
    .page-subtitle-info {{ $t('interface_config') }}

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('debug') }}
      v-switch(color="var(--cui-primary)" v-model="config.debug")

    label.form-input-label {{ $t('port') }}
    v-text-field(v-model.number="config.port" type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiNumeric'] }}

    v-divider.tw-mt-4.tw-mb-8
    
    .page-subtitle.tw-mt-8 {{ $t('ssl') }}
    .page-subtitle-info.tw-mb-5 {{ $t('ssl_config') }}

    label.form-input-label {{ $t('path_to_certificate') }}
    v-text-field(v-model="config.ssl.cert" prepend-inner-icon="mdi-at" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiAt'] }}

    label.form-input-label {{ $t('path_to_key') }}
    v-text-field(v-model="config.ssl.key" prepend-inner-icon="mdi-at" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiAt'] }}

    v-divider.tw-mt-4.tw-mb-8
    
    .page-subtitle.tw-mt-8 {{ $t('options') }}
    .page-subtitle-info.tw-mb-5 {{ $t('video_processor_config') }}

    label.form-input-label {{ $t('video_processor_path') }}
    v-text-field(v-model="config.options.videoProcessor" prepend-inner-icon="mdi-at" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiAt'] }}

    v-divider.tw-mt-4.tw-mb-8
    
    .page-subtitle.tw-mt-8 {{ $t('http') }}
    .page-subtitle-info {{ $t('http_server_config') }}

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="config.http.active")

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('localhost') }}
      v-switch(color="var(--cui-primary)" v-model="config.http.localHttp")

    label.form-input-label {{ $t('port') }}
    v-text-field(v-model.number="config.http.port" type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiNumeric'] }}

    v-divider.tw-mt-4.tw-mb-8
    
    .page-subtitle.tw-mt-8 {{ $t('smtp') }}
    .page-subtitle-info {{ $t('smtp_server_config') }}

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="config.smtp.active")

    label.form-input-label {{ $t('port') }}
    v-text-field(v-model.number="config.smtp.port" type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiNumeric'] }}

    label.form-input-label {{ $t('space_replace') }}
    v-text-field(v-model="config.smtp.space_replace" prepend-inner-icon="mdi-find-replace" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiFindReplace'] }}

    v-divider.tw-mt-4.tw-mb-8
    
    .page-subtitle.tw-mt-8 {{ $t('mqtt') }}
    .page-subtitle-info {{ $t('mqtt_config') }}

    .tw-flex.tw-justify-between.tw-items-center
      label.form-input-label {{ $t('enabled') }}
      v-switch(color="var(--cui-primary)" v-model="config.mqtt.active")

    label.form-input-label {{ $t('host') }}
    v-text-field(v-model="config.mqtt.host" prepend-inner-icon="mdi-web" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiWeb'] }}

    label.form-input-label {{ $t('port') }}
    v-text-field(v-model.number="config.mqtt.port" type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiNumeric'] }}

</template>

<script>
import compareVersions from 'compare-versions';
import VueMarkdown from 'vue-markdown';
import { mdiAt, mdiFindReplace, mdiNpm, mdiNumeric, mdiUpdate, mdiWeb } from '@mdi/js';

import { changeConfig, getConfig } from '@/api/config.api';
import { downloadDb, getChangelog, getDb, getPackage, restartSystem, updateSystem } from '@/api/system.api';
import { resetSettings } from '@/api/settings.api';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'SystemSettings',

  components: {
    VueMarkdown,
  },

  data: () => ({
    icons: {
      mdiAt,
      mdiFindReplace,
      mdiNpm,
      mdiNumeric,
      mdiUpdate,
      mdiWeb,
    },

    loading: true,
    loadingProgress: true,
    loadingSave: false,
    loadingReset: false,
    loadingRestart: false,
    loadingUpdate: false,
    loadingDb: false,

    resetDialog: false,
    restartDialog: false,
    updateDialog: false,

    availableVersions: [],
    changelog: '',
    config: {},
    configTimeout: null,
    currentVersion: null,
    dbFile: {},
    latestVersion: null,
    serviceMode: false,
    updateAvailable: false,
    npmPackageName: 'camera.ui',
  }),

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  async created() {
    try {
      const config = await getConfig('?target=config');
      const dbFile = await getDb();

      this.dbFile = dbFile.data;

      if (this.dbFile?.mtime) {
        this.dbFile.mtime = this.dbFile.mtime.replace('T', ', ').split('.')[0];
      }

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
      delete config.env;

      this.config = {
        port: config.data.port || window.location.port || 80,
        debug: config.data.debug || false,
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

      this.$watch('config', this.configWatcher, { deep: true });

      this.loading = false;
      this.loadingProgress = false;
    } catch (err) {
      console.log(err.message);
      this.$toast.error(err.message);
    }
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
    async configWatcher() {
      if (this.loadingRestart || this.loadingReset || this.loadingUpdate) {
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
    async onReset() {
      this.resetDialog = false;

      if (this.loadingReset) {
        return;
      }

      this.loadingProgress = true;
      this.loadingReset = true;
      this.lodingSave = true;
      this.loadingUpdate = true;
      this.loadingRestart = true;
      this.loadingDb = true;

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
        this.lodingSave = false;
        this.loadingUpdate = false;
        this.loadingRestart = false;
        this.loadingDb = false;
      }
    },
    async onRestart() {
      this.restartDialog = false;

      if (this.loadingRestart) {
        return;
      }

      this.loadingProgress = true;
      this.loadingRestart = true;
      this.loadingSave = true;
      this.loadingReset = true;
      this.loadingUpdate = true;
      this.loadingDb = true;

      //this.$toast.success(this.$t('system_restart_initiated'));

      try {
        await restartSystem();
        localStorage.setItem('restarted', true);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);

        this.loadingRestart = false;
        this.loadingProgress = false;
        this.loadingSave = false;
        this.loadingReset = false;
        this.loadingUpdate = false;
        this.loadingDb = false;
      }
    },
    async onUpdateRestart() {
      this.updateDialog = false;

      if (this.loadingUpdate || this.loadingRestart) {
        return;
      }

      this.loadingProgress = true;
      this.loadingUpdate = true;
      this.loadingRestart = true;
      this.loadingSave = true;
      this.loadingReset = true;
      this.loadingDb = true;

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
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);

        this.loadingProgress = false;
        this.loadingUpdate = false;
        this.loadingRestart = false;
        this.loadingSave = false;
        this.loadingReset = false;
        this.loadingDb = false;
      }
    },
  },
};
</script>

<style scoped>
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
</style>
