<template lang="pug">
div
  main.w-100.h-100vh.position-relative
    .container.pt-3.d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
      b-spinner.text-color-primary
    .container-fluid.position-fixed.p-0.m-0.inner-container(v-else)
      div#log.log
        my-terminal(:terminal="terminal" ref="xterm")
      .logUtils.d-flex.justify-content-end.align-content-center
        #removeButton(@click="onRemove" :class="loadingRemove ? 'btnError' : 'btnNoError'")
          b-spinner(style="color: #fff" small v-if="loadingRemove")
          b-icon(icon="trash-fill", aria-hidden="true" v-else)
        #dlButton(@click="onDownload" :class="loadingDownload ? 'btnError' : 'btnNoError'")
          b-spinner(style="color: #fff" small v-if="loadingDownload")
          b-icon(icon="download", aria-hidden="true" v-else)
        #shareButton(v-if="showShare", @click="onShare")
          b-spinner(style="color: #fff" small v-if="loadingShare")
          b-icon(icon="share-fill", aria-hidden="true" v-else)
</template>

<script>
import { BIcon, BIconDownload, BIconShareFill, BIconTrashFill } from 'bootstrap-vue';

import Console from '@/components/console.vue';
import SocketMixin from '@/mixins/socket.mixin';
import { downloadLog, removeLog } from '@/api/system.api';

export default {
  name: 'Log',
  components: {
    BIcon,
    BIconDownload,
    BIconShareFill,
    BIconTrashFill,
    'my-terminal': Console,
  },
  mixins: [SocketMixin],
  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },
  data() {
    return {
      loading: true,
      loadingDownload: false,
      loadingRemove: false,
      loadingShare: false,
      showShare: true,
      terminal: {
        pid: 1,
        name: 'terminal',
        cols: 1000,
        rows: 1000,
      },
    };
  },
  async created() {
    this.showShare = navigator.share ? true : false;
  },
  async mounted() {
    this.loading = false;
  },
  methods: {
    async onDownload() {
      const dlButton = document.getElementById('dlButton');
      dlButton.blur();

      this.loadingDownload = true;

      try {
        const response = await downloadLog();
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'camera.ui.log.txt');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err) {
        this.$toast.error(err.message);
      }

      this.loadingDownload = false;
    },
    async onRemove() {
      const removeButton = document.getElementById('removeButton');
      removeButton.blur();

      this.loadingRemove = true;

      try {
        await removeLog();
      } catch (err) {
        this.$toast.error(err.message);
      }

      this.loadingRemove = false;
    },
    async onShare() {
      this.loadingShare = true;

      try {
        const response = await downloadLog();
        const blob = new Blob([response.data], { type: 'text/plain' });

        const data = {
          title: this.$t('log'),
          text: `${this.$t('log')} - ${new Date()}`,
          files: [new File([blob], 'camera.ui.log.txt', { type: blob.type })],
        };

        navigator.share(data).catch((err) => {
          if (err?.message !== 'Abort due to cancellation of share.') {
            console.log(err);
            this.$toast.error(err.message);
          }
        });
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingShare = false;
    },
  },
};
</script>

<style scoped>
.inner-container {
  bottom: 0;
  top: 0;
  left: 0;
  right: 0;
  background: #000;
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

.dlButton,
.restartButton,
.saveButton,
.updateButton {
  height: 40px;
  transition: 0.3s all;
}

.log {
  height: calc(100% - 60px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  width: calc(100% - env(safe-area-inset-left, 0px) - env(safe-area-inset-left, 0px));
  margin-top: calc(65px + env(safe-area-inset-top, 0px));
  margin-left: auto;
  margin-right: auto;
}

.logUtils {
  position: fixed;
  height: 40px;
  top: calc(env(safe-area-inset-top, 0px) + 80px) !important;
  right: calc(env(safe-area-inset-right, 0px) + 20px) !important;
  z-index: 10;
}

#dlButton,
#removeButton,
#shareButton {
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

#dlButton {
  line-height: 2.5;
}

#dlButton:hover,
#removeButton:hover,
#shareButton:hover {
  opacity: 1;
}
</style>
