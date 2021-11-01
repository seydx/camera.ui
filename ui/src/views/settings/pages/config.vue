<template lang="pug">
.w-100.h-100
  vue-progress-bar
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
                  b-popover(custom-class="text-center" variant="light" target="popover-latestVersion" triggers="hover" placement="top" v-if="!updateAvailable" title="Latest version")
                    template v{{ latestVersion }}
                  a.d-block.w-100.text-center(id="popover-latestVersion" :href="npmLink" target="_blank" :class="updateAvailable ? 'text-danger' : 'text-success'") {{ updateAvailable ? $t('update_available') : $t('up_to_date') }}
                  div.w-100.text-center(style="font-size: 14px") v{{ currentVersion }}
            b-button#updateButton.w-100.mt-3.updateButton(@click="onUpdate" :class="loadingUpdate || loadingRestart || loadingSave || !updateAvailable ? 'btnError' : 'btnNoError'" :disabled="loadingUpdate || loadingRestart || loadingSave || !updateAvailable") 
              span(v-if="loadingUpdate") 
                b-spinner(style="color: #fff" type="grow" small)
              span(v-else) {{ $t('update') }}
            b-button#restartButton.w-100.mt-3.restartButton(@click="onRestart" :class="loadingRestart || loadingUpdate || loadingSave ? 'btnError' : 'btnNoError'" :disabled="loadingRestart || loadingUpdate || loadingSave") 
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
            b-button#saveButton.w-100.mt-3.saveButton(@click="onSave" :class="error || loadingSave ? 'btnError' : 'btnNoError'" :disabled="error || loadingSave") 
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
import { restartSystem, updateSystem } from '@/api/system.api';

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
      settingsLayout: {},
      currentVersion: null,
      latestVersion: null,
      npmLink: 'https://www.npmjs.com/package/camera.ui',
      npmPackageLink: 'https://api.npms.io/v2/search?q=camera.ui',
      npmPackageName: 'camera.ui',
      updateAvailable: false,
    };
  },
  async created() {
    try {
      const config = await getConfig('?target=config');
      this.config = { ...config.data };
      this.currentVersion = config.data.version;

      delete this.config.timestamp;
      delete this.config.platform;
      delete this.config.node;
      delete this.config.version;
      delete this.config.firstStart;

      const response = await fetch(this.npmPackageLink);
      const data = await response.json();

      const npmPackage = data.results?.find((pkg) => pkg?.package?.name === this.npmPackageName);
      this.latestVersion = npmPackage?.package?.version;

      this.updateAvailable = compareVersions.compare(this.latestVersion, this.currentVersion, '>=');

      this.loading = false;
    } catch (err) {
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
        await timeout(1000);
      } catch (error) {
        this.$toast.error(error.message);
      }

      this.loadingRestart = false;
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
        await updateSystem();
        await timeout(1000);

        this.$toast.success(this.$t('system_successfully_updated'));
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
</style>
