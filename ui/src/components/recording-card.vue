<template lang="pug">
v-card.card.fill-height.video-card.tw-overflow-hidden.tw-flex.tw-flex-col(v-if="!list")

  v-checkbox.select-checkbox(v-model="selected" @change="$emit('select')")
        
  v-img.video-card-img.tw-items-end.tw-text-white.tw-relative.tw-cursor-pointer(v-on:error="handleErrorImg" :src="src" height="calc(100% - 37px)" @click="$emit('show')" :class="errorImg ? 'errorImg' : ''")
    template(v-slot:placeholder)
      .tw-flex.tw-justify-center.tw-items-center.tw-h-full
        v-progress-circular(indeterminate color="var(--cui-primary)" size="22")
    .tw-z-10.tw-absolute.tw-bottom-0
      v-card-title.tw-leading-none.text-shadow.tw-text-base {{ recording.camera }}
      v-card-subtitle.text-muted.text-shadow.tw-text-sm {{ recording.label.includes("no label") ? $t("no_label") : recording.label.includes("Custom") ? $t("custom") : recording.label }}
    .shadow.tw-absolute.tw-inset-0

  .video-card-content.tw-relative
    v-icon.text-default(small style="margin-top: -3px; margin-right: 5px") {{ icons['mdiClockTimeNineOutline'] }}
    span.text-font-disabled {{ recording.time }}
    v-btn.tw-text-white(style="top: -20px; right: 10px" width="36px" height="36px" @click="download(item)" :loading="downloading" absolute color="#333333" fab right top)
      v-icon(small) {{ icons['mdiDownload'] }}
    //v-btn.tw-text-white(style="top: -20px; right: 10px" width="36px" height="36px" @click="remove" :loading="removing" small absolute color="red" fab right top)
      v-icon(small) {{ icons['mdiTrashCan'] }}

v-card.card.fill-height.video-card.tw-overflow-hidden.tw-flex.tw-flex-col(v-else)
  v-img.video-card-img.tw-items-end.tw-text-white.tw-relative.tw-cursor-pointer(v-on:error="handleErrorImg" :src="src" height="calc(100% - 37px)" @click="$emit('show')" :class="errorImg ? 'errorImg' : ''")
    template(v-slot:placeholder)
      .tw-flex.tw-justify-center.tw-items-center.tw-h-full
        v-progress-circular(indeterminate color="var(--cui-primary)" size="22")
    .shadow.tw-absolute.tw-inset-0
  
</template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiClockTimeNineOutline, mdiDownload, mdiTrashCan } from '@mdi/js';
import { saveAs } from 'file-saver';

import { removeRecording } from '@/api/recordings.api';

export default {
  props: {
    list: Boolean,
    recording: Object,
    selectedItems: Array,
  },

  data() {
    return {
      downloading: false,
      errorImg: false,
      icons: {
        mdiClockTimeNineOutline,
        mdiDownload,
        mdiTrashCan,
      },
      item: {
        fileName: this.recording.fileName,
        url: '/files/' + this.recording.fileName,
      },
      removing: false,
      src: `/files/${
        this.recording.recordType === 'Video' ? `${this.recording.name}@2.jpeg` : this.recording.fileName
      }`,
      selected: false,
    };
  },

  watch: {
    selectedItems: {
      handler() {
        this.selected = this.selectedItems.some((item) => item.id === this.recording.id);
      },
    },
  },

  mounted() {
    this.selected = this.selectedItems.some((item) => item.id === this.recording.id);
  },

  methods: {
    download({ url, fileName }) {
      this.downloading = true;

      const isSafari = navigator.appVersion.indexOf('Safari/') !== -1 && navigator.appVersion.indexOf('Chrome') === -1;

      const downloadFinished = () => {
        setTimeout(() => (this.downloading = false), 1000);
      };

      if (isSafari) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'blob';

        xhr.onload = function () {
          saveAs(xhr.response, fileName);
          downloadFinished();
        };

        xhr.onerror = function () {
          console.error('download failed', url);
          this.$toast.error(`${this.$t('download_failed')}`);
          downloadFinished();
        };

        xhr.send();
        return;
      }

      // Create download link.
      const link = document.createElement('a');

      if (fileName) {
        link.download = fileName;
      }

      link.href = url;
      link.style.display = 'none';

      document.body.appendChild(link);

      // Start download.
      link.click();

      // Remove download link.
      document.body.removeChild(link);

      downloadFinished();
    },
    handleErrorImg() {
      this.errorImg = true;
      this.src = require('../assets/img/logo.png');
    },
    async remove() {
      this.removing = true;

      try {
        await removeRecording(this.recording.id, '?refresh=true');
        this.$emit('remove');
        this.removing = false;
      } catch (err) {
        this.removing = false;

        console.log(err);
        this.$toast.error(err.message);
      }
    },
  },
};
</script>

<style scoped>
.video-card {
  color: var(--cui-text-default) !important;
  height: 100%;
  background: #000 !important;
  border-radius: 10px !important;
  box-shadow: 0px 3px 1px -2px rgb(0 0 0 / 20%), 0px 2px 2px 0px rgb(0 0 0 / 14%), 0px 1px 5px 0px rgb(0 0 0 / 12%) !important;
}

.video-card-img {
  border-top-left-radius: 10px !important;
  border-top-right-radius: 10px !important;
}

.video-card-title {
  padding: 0;
  margin: 0;
  font-size: 13px;
  background: var(--cui-bg-card);
  padding: 4px;
  padding-left: 10px;
  padding-right: 10px;
}

.video-card-content {
  /*background: rgba(var(--cui-bg-card-rgb));*/
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px;
  font-size: 0.7rem;
}

.shadow {
  background: -moz-linear-gradient(45deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%); /* FF3.6-15 */
  background: -webkit-linear-gradient(45deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%); /* Chrome10-25,Safari5.1-6 */
  background: linear-gradient(
    45deg,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 0) 100%
  ); /* W3C, IE10+, FF16+, Chrome26+, Opera12+, Safari7+ */
  filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#000000', endColorstr='#00000000',GradientType=1 ); /* IE6-9 fallback on horizontal gradient */
}

div >>> .v-image__image--contain {
  background-size: unset !important;
}

.errorImg >>> .v-image__image {
  background-size: 50% !important;
}

.select-checkbox {
  position: absolute;
  z-index: 1;
  left: 10px;
  top: 5px;
  margin: 0;
}
</style>
