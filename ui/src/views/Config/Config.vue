<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.config-container.tw-relative(v-else)

  .tw-max-w-10xl.tw-relative.tw-h-full

    .save-btn(:style="loadingSave ? 'opacity: 1 !important' : ''")
      v-btn.tw-text-white(fab height="40px" width="40px" color="success" @click="onSave" :loading="loadingSave")
        v-icon.tw-text-white mdi-check-bold

    v-jsoneditor(
      v-model="config" 
      :options="options" 
      :plus="false" 
      height="100%" 
      @error="onError"
      @input="onInput"
    )     

  CoolLightBox(
    :items="notImages" 
    :index="notIndex"
    @close="closeHandler"
    :closeOnClickOutsideMobile="true"
    :useZoomBar="true",
    :zIndex=99999
  )

</template>

<script>
import CoolLightBox from 'vue-cool-lightbox';
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';
import VJsoneditor from 'v-jsoneditor';

import { changeConfig, getConfig } from '@/api/config.api';
import socket from '@/mixins/socket';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Config',

  components: {
    CoolLightBox,
    VJsoneditor,
  },

  mixins: [socket],

  data: () => ({
    config: {},
    error: false,
    loading: true,
    loadingSave: false,
    options: {
      mode: 'code',
      modes: ['code'],
      statusBar: false,
      mainMenuBar: false,
      colorPicker: false,
    },
  }),

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  async mounted() {
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
    delete this.config.env;
    this.config.cameras?.forEach((camera) => delete camera.recordOnMovement);

    window.addEventListener('orientationchange', this.resizeHandler);
    document.addEventListener('keydown', this.onKeyboardSave, false);

    this.loading = false;
  },

  beforeDestroy() {
    window.removeEventListener('orientationchange', this.resizeHandler);
    document.removeEventListener('keydown', this.onKeyboardSave);
  },

  methods: {
    onError(e) {
      this.error = e;
    },
    onInput() {
      this.error = false;
    },
    async onKeyboardSave(e) {
      if ((window.navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey) && e.keyCode == 83) {
        e.preventDefault();
        await this.onSave();
      }
    },
    async onSave() {
      if (this.loadingSave) {
        return;
      } else if (this.error) {
        this.loadingSave = false;
        return this.$toast.error(this.error.toString());
      }

      this.loadingSave = true;

      try {
        await changeConfig(this.config);
        await timeout(1000);

        this.$toast.success(this.$t('config_was_saved'));
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingSave = false;
    },
    resizeHandler() {
      if (typeof Event === 'function') {
        window.dispatchEvent(new Event('resize'));
      } else {
        const evt = window.document.createEvent('UIEvents');
        evt.initUIEvent('resize', true, false, window, 0);
        window.dispatchEvent(evt);
      }
    },
  },
};
</script>

<style scoped>
.config-container {
  background: #121212;
  height: calc(100vh - 64px - 44px - env(safe-area-inset-top, 0px));
  border: unset !important;
  padding-top: 10px;
  padding-bottom: 10px;
  padding-left: clamp(10px, env(safe-area-inset-left, 10px), env(safe-area-inset-left, 10px));
  padding-right: clamp(10px, env(safe-area-inset-right, 10px), env(safe-area-inset-right, 10px));
}

.save-btn {
  opacity: 0.2;
  transition: 0.3s opacity;
  position: absolute;
  top: 10px;
  right: clamp(10px, env(safe-area-inset-left, 10px), env(safe-area-inset-right, 10px));
  z-index: 10;
}

.save-btn:hover {
  opacity: 1;
}

div >>> .jsoneditor {
  border: none;
}

div >>> .ace_editor {
  font-size: 14px !important;
}

div >>> .ace-jsoneditor .ace_scroller {
  background-color: #121212;
}

div >>> .ace-jsoneditor .ace_gutter {
  background: #121212;
  color: #808080;
}

div >>> .jsoneditor-statusbar {
  color: #808080;
  background-color: #121212;
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
</style>