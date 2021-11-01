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
                  a.d-block.w-100.text-center(:href="npmLink" target="_blank" :class="updateAvailable ? 'text-danger' : 'text-success'") {{ updateAvailable ? $t('update_available') : $t('up_to_date') }}
                  div.w-100.text-center(style="font-size: 14px") v{{ latestVersion }}
            b-button#updateButton.w-100.mt-3.updateButton(@click="onUpdate") {{ $t('update') }}
      .col-12(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel('admin')")
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
            b-button#saveButton.w-100.mt-3.saveButton(@click="onSave") {{ $t('save') }}
          b-card(class="mt-3" :header="$t('error')" v-if="error")
            pre.m-0(style="color: var(--primary-font-color)") {{ error }}
</template>

<script>
import { BIcon, BIconTriangleFill } from 'bootstrap-vue';
import compareVersions from 'compare-versions';
import { ToggleButton } from 'vue-js-toggle-button';
import VJsoneditor from 'v-jsoneditor';

import { getConfig } from '@/api/config.api';

import localStorageMixin from '@/mixins/localstorage.mixin';

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
      error: '',
      options: {
        mode: 'code',
        modes: ['code'],
        mainMenuBar: false,
        colorPicker: false,
      },
      loading: true,
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
      const config = await getConfig('?target=ui');
      this.config = { ...config.data };
      this.currentVersion = config.data.version;

      delete this.config.timestamp;
      delete this.config.platform;
      delete this.config.node;
      delete this.config.version;
      delete this.config.firstStart;

      delete this.config.ssl?.keyBuffer;
      delete this.config.ssl?.certBuffer;

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
    onSave() {
      const saveButton = document.getElementById('saveButton');
      saveButton.blur();
    },
    onUpdate() {
      const updateButton = document.getElementById('updateButton');
      updateButton.blur();
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
  border: 1px solid var(--fourth-bg-color);
}

div >>> .ace-jsoneditor .ace_scroller {
  background-color: var(--secondary-bg-color);
}

div >>> .ace-jsoneditor .ace_gutter {
  background: var(--third-bg-color);
  color: var(--primary-font-color);
}

div >>> .jsoneditor-statusbar {
  color: var(--primary-font-color);
  background-color: var(--third-bg-color);
  border-top: 1px solid #747474;
}

div >>> .ace-jsoneditor .ace_marker-layer .ace_active-line {
  background: rgba(0, 0, 0, 0.3);
}

div >>> .ace-jsoneditor .ace_marker-layer .ace_selection {
  background: rgba(0, 0, 0, 0.3);
}

div >>> .ace-jsoneditor .ace_gutter-active-line {
  background-color: rgba(119, 119, 119, 0.6);
}

div >>> .ace-jsoneditor .ace_variable {
  color: var(--editor-main-color);
}

div >>> .ace-jsoneditor .ace_indent-guide {
  background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAE0lEQVQImWP4////f4bLly//BwAmVgd1/w11/gAAAABJRU5ErkJggg==)
    right repeat-y;
  opacity: 0.2;
}

.card {
  background-color: var(--third-bg-color);
  color: var(--primary-font-color);
}

.saveButton,
.updateButton {
  height: 40px;
  transition: 0.3s all;
  background: var(--primary-color);
}

.saveButton:hover,
.saveButton:focus,
.saveButton:active,
.updateButton:hover,
.updateButton:focus,
.updateButton:active {
  background: var(--secondary-color) !important;
}
</style>
