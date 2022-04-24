<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-7.tw-mt-5(v-if="!loading")
    .page-subtitle {{ $t('backup') }}
    .page-subtitle-info {{ $t('create_zipped_backup_file') }}

    p.tw-mt-4.tw-mb-8 {{ $t('backup_info_download') }}
    
    v-btn.tw-text-white(:loading="loadingBackupDl" color="var(--cui-primary)" @click="downloadBackup") {{ $t('download_backup_archive') }}

    v-divider.tw-mt-4.tw-mb-8
    
    .page-subtitle.tw-mt-8 {{ $t('restore') }}
    .page-subtitle-info {{ $t('restore_from_backup_file') }}

    p.tw-mt-4.tw-mb-8 {{ $t('backup_info_restore') }}
    
    v-file-input.tw-mt-4(id="backup-file" ref="file-input-backup" chips accept="application/gzip, .tar, .tar.gz" :label="$t('backup_file')" solo)
    v-btn.tw-text-white(:loading="loadingBackupUl" color="var(--cui-primary)" @click="restoreBackup") {{ $t('upload_backup_archive') }}

    v-divider.tw-mt-4.tw-mb-8

    .page-subtitle.tw-mt-8 {{ $t('backup_shedule') }}
    .page-subtitle-info {{ $t('automated_backup') }}

    p.tw-mt-4.tw-mb-8 {{ $t('backup_info_shedule') }}

    span.text-muted.tw-italic coming soon...
</template>

<script>
import { downloadBackup, restoreBackup } from '@/api/backup.api';

export default {
  name: 'BackupSettings',

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data: () => ({
    loading: true,
    loadingProgress: true,
    loadingBackupDl: false,
    loadingBackupUl: false,
  }),

  async created() {
    this.loading = false;
    this.loadingProgress = false;
  },

  methods: {
    async downloadBackup() {
      if (this.loadingBackupDl) {
        return;
      }

      this.loadingProgress = true;
      this.loadingBackupDl = true;

      try {
        const userStorage = {
          camviewLayout: localStorage.getItem('camview-layouts'),
          dashboardLayout: localStorage.getItem('dashboard-layout'),
          theme: localStorage.getItem('theme'),
          themeColor: localStorage.getItem('theme-color'),
          language: localStorage.getItem('language'),
          darkmode: localStorage.getItem('darkmode'),
        };

        const response = await downloadBackup(JSON.stringify(userStorage));
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');

        link.href = url;
        link.setAttribute('download', 'cameraui-backup.tar.gz');

        document.body.appendChild(link);

        link.click();
        link.remove();
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingProgress = false;
      this.loadingBackupDl = false;
    },
    async restoreBackup() {
      if (this.loadingBackupUl) {
        return;
      }

      this.loadingProgress = true;
      this.loadingBackupUl = true;

      try {
        const file = document.getElementById('backup-file').files[0];

        if (file) {
          const formData = new FormData();
          formData.append('file', file);

          const userStorage = await restoreBackup(formData);
          this.restoreLocalStorage(userStorage.data);

          this.$refs['file-input-backup'].reset();
          this.$toast.success(this.$t('backup_restored'));

          await this.$store.dispatch('auth/logout');
          setTimeout(() => this.$router.push('/'), 200);
          //window.location.reload(true);
        } else {
          this.$toast.error(this.$t('no_file_selected'));
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.loadingProgress = false;
      this.loadingBackupUl = false;
    },
    restoreLocalStorage(storage) {
      if (storage.camviewLayout) {
        localStorage.setItem('camview-layouts', JSON.stringify(storage.camviewLayout));
      }
      if (storage.dashboardLayout) {
        localStorage.setItem('dashboard-layout', JSON.stringify(storage.dashboardLayout));
      }
      if (storage.theme) {
        localStorage.setItem('theme', storage.theme);
      }
      if (storage.themeColor) {
        localStorage.setItem('theme-color', storage.themeColor);
      }
      if (storage.darkmode) {
        localStorage.setItem('darkmode', storage.darkmode);
      }
      if (storage.language) {
        localStorage.setItem('language', storage.language);
      }
    },
  },
};
</script>

<style scoped>
div >>> .v-input__icon > button {
  color: var(--cui-text-default);
}
</style>
