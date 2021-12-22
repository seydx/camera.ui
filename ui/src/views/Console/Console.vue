<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.console-container.tw-relative(v-else)
  #log.tw-relative.tw-h-full
    .utils.tw-flex.tw-justify-between.tw-items-center
      .remove-btn.tw-block.tw-ml-auto
        v-btn.tw-text-white.tw-mr-1(fab height="40px" width="40px" color="rgba(var(--cui-primary-rgb))" @click="onRemove" :loading="loadingRemove")
          v-icon.tw-text-white {{ icons['mdiDeleteEmpty'] }}
      .dl-btn.tw-block.tw-ml-1
        v-btn.tw-text-white.tw-mr-1(fab height="40px" width="40px" color="rgba(var(--cui-primary-rgb))" @click="onDownload" :loading="loadingDownload")
          v-icon.tw-text-white {{ icons['mdiDownload'] }}
      .share-btn.tw-block.tw-ml-1(v-if="showShare")
        v-btn.tw-text-white.tw-mr-1(fab height="40px" width="40px" color="rgba(var(--cui-primary-rgb))" @click="onShare" :loading="loadingShare")
          v-icon.tw-text-white {{ icons['mdiShareVariant'] }}
    
    my-terminal(:terminal="terminal" ref="xterm")

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
import { mdiDeleteEmpty, mdiDownload, mdiShareVariant } from '@mdi/js';

import { downloadLog, removeLog } from '@/api/system.api';
import socket from '@/mixins/socket';

import Console from '@/components/console.vue';

export default {
  name: 'Console',

  components: {
    CoolLightBox,
    'my-terminal': Console,
  },

  mixins: [socket],

  data: () => ({
    icons: {
      mdiDeleteEmpty,
      mdiDownload,
      mdiShareVariant,
    },

    loading: true,
    loadingDownload: false,
    loadingRemove: false,
    loadingShare: false,

    showShare: true,
    terminal: {
      pid: 1,
      name: 'terminal',
    },
  }),

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  created() {
    this.showShare = navigator.share ? true : false;
  },

  mounted() {
    this.loading = false;
  },

  methods: {
    async onDownload() {
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
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingDownload = false;
    },
    async onRemove() {
      this.loadingRemove = true;

      try {
        await removeLog();
      } catch (err) {
        console.log(err);
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
.console-container {
  background: #000;
  overflow: hidden;
  height: calc(100vh - 64px - 44px - env(safe-area-inset-top, 0px));
  border: 1px solid rgba(var(--cui-bg-app-bar-border-rgb));
  padding-top: 10px;
  padding-bottom: 10px;
  padding-left: clamp(10px, env(safe-area-inset-left, 10px), env(safe-area-inset-left, 10px));
  padding-right: clamp(10px, env(safe-area-inset-left, 10px), env(safe-area-inset-right, 10px));
}

.utils {
  position: absolute;
  height: 40px;
  top: 10px;
  right: clamp(10px, env(safe-area-inset-left, 10px), env(safe-area-inset-right, 10px));
  z-index: 10;
}

.remove-btn,
.dl-btn,
.share-btn {
  opacity: 0.2;
  transition: 0.3s all;
}

.remove-btn:hover,
.dl-btn:hover,
.share-btn:hover {
  opacity: 1;
}

div >>> .xterm .xterm-viewport {
  width: 100% !important;
}
</style>
