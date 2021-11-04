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
      .col-12(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel('admin')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.config.server.expand ? "180" : "-90"', @click="settingsLayout.config.server.expand = !settingsLayout.config.server.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.config.server.expand = !settingsLayout.config.server.expand") {{ $t("server") }}
        b-collapse(
          v-model="settingsLayout.config.server.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center
                  a.d-block.w-100.text-center.mb-2(:href="'https://www.npmjs.com/package/' + npmPackageName" target="_blank" :class="updateAvailable ? 'text-danger' : 'text-success'") {{ updateAvailable ? $t('update_available') : $t('up_to_date') }}
                  b-form-select.versionSelect(v-model="currentVersion" :options="availableVersions")
            b-button#updateButton.w-100.mt-3.updateButton(@click="onUpdate" :class="loadingUpdate || loadingRestart || loadingSave ? 'btnError' : 'btnNoError'" :disabled="loadingUpdate || loadingRestart || loadingSave") 
              span(v-if="loadingUpdate") 
                b-spinner(style="color: #fff" type="grow" small)
              span(v-else) {{ $t('update') }}
            b-button#restartButton.w-100.mt-3.restartButton(v-if="serviceMode" @click="onRestart" :class="loadingRestart || loadingUpdate || loadingSave ? 'btnError' : 'btnNoError'" :disabled="loadingRestart || loadingUpdate || loadingSave") 
              span(v-if="loadingRestart") 
                b-spinner(style="color: #fff" type="grow" small)
              span(v-else) {{ $t('restart') }}
      .col-12.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel('admin')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.config.config.expand ? "180" : "-90"', @click="settingsLayout.config.config.expand = !settingsLayout.config.config.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.config.config.expand = !settingsLayout.config.config.expand") {{ $t('config') }}
        b-collapse(
          v-model="settingsLayout.config.config.expand"
        )
          div.mt-2.mb-4
            v-jsoneditor(
              v-model="config" 
              :options="options" 
              :plus="false" 
              height="500px" 
              @error="onError"
              @input="onInput"
            )
            b-card(class="mt-3" :header="$t('error')" v-if="error")
              pre.m-0(style="color: var(--primary-font-color)") {{ error }}
            b-button#saveButton.w-100.mt-3.saveButton(@click="onSave" :class="error || loadingSave || loadingRestart ? 'btnError' : 'btnNoError'" :disabled="error || loadingSave || loadingRestart") 
              span(v-if="loadingSave") 
                b-spinner(style="color: #fff" type="grow" small)
              span(v-else) {{ $t('save') }}
</template>

<script>
import { BIcon, BIconTriangleFill } from 'bootstrap-vue';
import compareVersions from 'compare-versions';
import { ToggleButton } from 'vue-js-toggle-button';
import VJsoneditor from 'v-jsoneditor';

import { changeConfig, getConfig } from '@/api/config.api';
import { getPackage, restartSystem, updateSystem } from '@/api/system.api';

import localStorageMixin from '@/mixins/localstorage.mixin';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'SettingsConfig',
  components: {
    BIcon,
    BIconTriangleFill,
    ToggleButton,
    VJsoneditor,
  },
  mixins: [localStorageMixin],
  data() {
    return {
      availableVersions: [],
      config: {},
      error: false,
      options: {
        mode: 'code',
        modes: ['code'],
        statusBar: false,
        mainMenuBar: false,
        colorPicker: false,
      },
      loading: true,
      loadingRestart: false,
      loadingSave: false,
      loadingUpdate: false,
      serviceMode: false,
      settingsLayout: {},
      currentVersion: null,
      latestVersion: null,
      npmPackageName: 'camera.ui',
      updateAvailable: false,
    };
  },
  async created() {
    try {
      const config = await getConfig('?target=config');
      this.config = { ...config.data };

      //remove not used params from config editor
      delete this.config.timestamp;
      delete this.config.platform;
      delete this.config.node;
      delete this.config.version;
      delete this.config.firstStart;
      delete this.config.mqttConfigs;
      delete this.config.serviceMode;
      this.config.cameras?.forEach((camera) => delete camera.recordOnMovement);

      this.serviceMode = config.data.serviceMode;
      this.currentVersion = config.data.version;

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

      this.loading = false;
    } catch (err) {
      console.log(err.message);
      this.$toast.error(err.message);
    }
  },
  methods: {
    onError(e) {
      this.error = e;
    },
    onInput() {
      this.error = false;
    },
    async onRestart() {
      const restartButton = document.getElementById('restartButton');
      restartButton.blur();

      if (this.loadingRestart) {
        return;
      }

      this.loadingRestart = true;

      this.$toast.success(this.$t('system_restart_initiated'));

      try {
        await restartSystem();
      } catch (error) {
        this.$toast.error(error.message);
        this.loadingRestart = false;
      }
    },
    async onSave() {
      const saveButton = document.getElementById('saveButton');
      saveButton.blur();

      if (this.loadingSave) {
        return;
      }

      this.loadingSave = true;

      try {
        await changeConfig(this.config);
        await timeout(1000);

        this.$toast.success(this.$t('config_was_saved'));
      } catch (error) {
        this.$toast.error(error.message);
      }

      this.loadingSave = false;
    },
    async onUpdate() {
      const updateButton = document.getElementById('updateButton');
      updateButton.blur();

      if (this.loadingUpdate) {
        return;
      }

      this.loadingUpdate = true;
      this.$toast.success(this.$t('system_update_initiated'));

      try {
        await updateSystem(`?version=${this.currentVersion}`);
        await timeout(1000);

        //this.$toast.success(this.$t('system_successfully_updated'));
      } catch (error) {
        this.$toast.error(error.message);
      }

      this.loadingUpdate = false;
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

div >>> .jsoneditor {
  border: 1px solid #363636;
}

div >>> .ace_editor {
  font-size: 14px !important;
}

div >>> .ace-jsoneditor .ace_scroller {
  background-color: #1e1e1e;
}

div >>> .ace-jsoneditor .ace_gutter {
  background: #1e1e1e;
  color: #808080;
}

div >>> .jsoneditor-statusbar {
  color: #808080;
  background-color: #1e1e1e;
  border-top: 1px solid #2e2e2e;
}

div >>> .ace-jsoneditor .ace_marker-layer .ace_active-line {
  background: rgba(0, 0, 0, 0);
  border: 2px solid rgba(66, 66, 66, 0.336);
}

div >>> .ace-jsoneditor .ace_marker-layer .ace_selection {
  background: #13517c;
}

div >>> .ace-jsoneditor .ace_gutter-active-line {
  background: none;
  color: #d3d3d3;
}

div >>> .ace-jsoneditor .ace_indent-guide {
  background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAE0lEQVQImWP4////f4bLly//BwAmVgd1/w11/gAAAABJRU5ErkJggg==)
    right repeat-y;
  opacity: 0.2;
}

div >>> .ace-jsoneditor .ace_cursor {
  border-left: 2px solid #fff;
}

div >>> .ace_mobile-menu {
  border-radius: 4px;
  background: #252526;
  /*box-shadow: 1px 3px 2px grey;*/
  -webkit-box-shadow: 0px 9px 11px -1px #000000;
  box-shadow: 0px 9px 11px -1px #000000;
  border: 1px solid #303030;
  color: #cccccc;
}

div >>> .ace_search {
  background: #252526;
  color: #cccccc;
  -webkit-box-shadow: 0px 9px 11px -1px #000000;
  box-shadow: 0px 9px 11px -1px #000000;
  border: 1px solid #303030;
  border-top: 0 none;
  padding: 10px;
}

div >>> .ace_search_field {
  min-height: 2em;
  background: #3c3c3c;
  color: #cccccc;
  padding-left: 6px;
}

div >>> .ace_searchbtn {
  border: 1px solid #cbcbcb;
  background: #3c3c3c;
  border: 1px solid #474747;
  color: #cccccc;
}

div >>> .ace_button {
  color: #cccccc;
}

div >>> .ace_mobile-button:hover {
  background: none;
}

div >>> .ace-jsoneditor .ace_text-layer {
  color: #fff;
}

div >>> .ace-jsoneditor .ace_variable {
  color: #85d8fb;
}

div >>> .ace-jsoneditor .ace_string {
  color: #d88d73;
}

div >>> .ace-jsoneditor .ace_boolean {
  color: #389edb;
}

div >>> .ace-jsoneditor .ace_numeric {
  color: #aecfa4;
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
  background: var(--primary-color);
}

.btnNoError:hover,
.btnNoError:focus,
.btnNoError:active {
  background: var(--secondary-color) !important;
}

.restartButton,
.saveButton,
.updateButton {
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
</style>
