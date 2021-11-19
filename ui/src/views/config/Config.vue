<template lang="pug">
div
  main.w-100.h-100vh.position-relative
    .container.pt-3.d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
      b-spinner.text-color-primary
    .container-fluid.position-fixed.p-0.m-0.inner-container(v-else)
      div#config.config
        v-jsoneditor(
          v-model="config" 
          :options="options" 
          :plus="false" 
          height="100%" 
          @error="onError"
          @input="onInput"
        )
      .configUtils.d-flex.justify-content-end.align-content-center
        #saveButton(@click="onSave" :class="error || loadingSave ? 'btnError' : 'btnNoError'" :disabled="error || loadingSave")
          b-spinner(style="color: #fff" small v-if="loadingSave")
          b-icon(icon="check", aria-hidden="true" v-else)
</template>

<script>
import { BIcon, BIconCheck } from 'bootstrap-vue';
import VJsoneditor from 'v-jsoneditor';

import { changeConfig, getConfig } from '@/api/config.api';
import SocketMixin from '@/mixins/socket.mixin';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Log',
  components: {
    BIcon,
    BIconCheck,
    VJsoneditor,
  },
  mixins: [SocketMixin],
  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },
  data() {
    return {
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

      window.addEventListener('orientationchange', this.resizeHandler);
      //window.addEventListener('resize', this.resizeHandler);
      document.addEventListener('keydown', this.onKeyboardSave, false);

      this.loading = false;
    } catch (err) {
      console.log(err.message);
      this.$toast.error(err.message);
    }
  },
  beforeDestroy() {
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
      const saveButton = document.getElementById('saveButton');
      saveButton.blur();

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
      } catch (error) {
        this.$toast.error(error.message);
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
.inner-container {
  background-color: #1e1e1e;
  bottom: 0;
  top: 0;
  left: 0;
  right: 0;
}

.config {
  height: calc(100% - 60px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  width: calc(100% - env(safe-area-inset-left, 0px) - env(safe-area-inset-left, 0px));
  margin-top: calc(65px + env(safe-area-inset-top, 0px));
  margin-left: auto;
  margin-right: auto;
}

.configUtils {
  position: fixed;
  height: 40px;
  top: calc(env(safe-area-inset-top, 0px) + 80px) !important;
  right: calc(env(safe-area-inset-right, 0px) + 20px) !important;
  z-index: 10;
}

.btnError {
  background: #5e5e5e !important;
  cursor: not-allowed !important;
}

.btnNoError {
  background: var(--primary-color) !important;
}

.btnNoError:hover,
.btnNoError:focus,
.btnNoError:active {
  background: var(--secondary-color) !important;
}

.saveButton {
  height: 40px;
  transition: 0.3s all;
}

#saveButton {
  display: block;
  width: 40px;
  height: 40px;
  background: var(--primary-color);
  border-radius: 30px;
  text-align: center;
  line-height: 2.7;
  opacity: 0.4;
  transition: 0.3s all;
  cursor: pointer;
  color: #fff;
  margin-left: 10px;
}

#saveButton:hover {
  opacity: 1;
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
</style>
