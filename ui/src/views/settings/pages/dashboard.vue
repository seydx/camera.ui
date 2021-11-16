<template lang="pug">
.w-100.h-100
  vue-progress-bar
  .d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
    b-spinner.text-color-primary
  transition-group(name="fade", mode="out-in", v-if="loading")
  transition-group(name="fade", mode="out-in", v-else)
    .d-flex.flex-wrap.justify-content-between(key="loaded")
      .col-12(v-if="checkLevel('settings:dashboard:edit')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.dashboard.dashboard.expand ? "180" : "-90"', @click="settingsLayout.dashboard.dashboard.expand = !settingsLayout.dashboard.dashboard.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.dashboard.dashboard.expand = !settingsLayout.dashboard.dashboard.expand") {{ $t("dashboard") }}
        b-collapse(
          v-model="settingsLayout.dashboard.dashboard.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("snapshot_timer") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                  b-form-select(
                    v-model="dashboard.refreshTimer"
                    :options="refreshTimer"
                  )
      .col-12.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel(['settings:cameras:edit', 'settings:dashboard:edit'])")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.dashboard.favourites.expand ? "180" : "-90"', @click="settingsLayout.dashboard.favourites.expand = !settingsLayout.dashboard.favourites.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.dashboard.favourites.expand = !settingsLayout.dashboard.favourites.expand") {{ $t("favourites") }}
        b-collapse(
          v-model="settingsLayout.dashboard.favourites.expand"
        )
          div.mt-2.mb-4(v-for="camera in cameras" :key="camera.name" data-aos="fade-up" data-aos-duration="1000")
            b-icon.cursor-pointer.expandTriangleCamera(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.dashboard.favourites.camerasExpands[camera.name] ? "180" : "-90"', @click="settingsLayout.dashboard.favourites.camerasExpands[camera.name] = !settingsLayout.dashboard.favourites.camerasExpands[camera.name]")
            .settings-box-header(@click="settingsLayout.dashboard.favourites.camerasExpands[camera.name] = !settingsLayout.dashboard.favourites.camerasExpands[camera.name]") {{ camera.name }}
            b-collapse(
              v-model="settingsLayout.dashboard.favourites.camerasExpands[camera.name]"
            )
              .settings-box.container.no-radius-top
                .row
                  .col-8.d-flex.flex-wrap.align-content-center {{ $t("favourite") }}
                  .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="camera.dashboard.favourite",
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true"
                    )
                hr.hr-underline(v-if="camera.dashboard.favourite")
                .row(v-if="camera.dashboard.favourite")
                  .col-8.d-flex.flex-wrap.align-content-center {{ $t("livestream") }}
                  .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="camera.dashboard.live",
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true"
                    )
          .w-100.mt-4.text-muted-2.text-center(v-if="!cameras.length") {{ $t("no_cameras") }}
</template>

<script>
import { BIcon, BIconTriangleFill } from 'bootstrap-vue';
import { ToggleButton } from 'vue-js-toggle-button';

import { getSetting, changeSetting } from '@/api/settings.api';
import localStorageMixin from '@/mixins/localstorage.mixin';

export default {
  name: 'SettingsDashboard',
  components: {
    BIcon,
    BIconTriangleFill,
    ToggleButton,
  },
  mixins: [localStorageMixin],
  data() {
    return {
      cameras: [],
      camerasTimer: null,
      dashboard: {},
      dashboardTimer: null,
      loading: true,
      refreshTimer: [10, 20, 30, 40, 50, 60],
    };
  },
  async created() {
    try {
      if (this.checkLevel('settings:dashboard:access')) {
        const dashboard = await getSetting('dashboard');
        this.dashboard = dashboard.data;
      }

      if (this.checkLevel('settings:cameras:access')) {
        const cameras = await getSetting('cameras');
        this.cameras = cameras.data;
      }

      this.$watch('cameras', this.camerasWatcher, { deep: true });
      this.$watch('dashboard', this.dashboardWatcher, { deep: true });

      this.loading = false;
    } catch (err) {
      this.$toast.error(err.message);
    }
  },
  methods: {
    async camerasWatcher(newValue) {
      this.$Progress.start();

      if (this.camerasTimer) {
        clearTimeout(this.camerasTimer);
        this.camerasTimer = null;
      }

      this.camerasTimer = setTimeout(async () => {
        try {
          await changeSetting('cameras', newValue, '?stopStream=true');
          this.$Progress.finish();
        } catch (error) {
          this.$toast.error(error.message);
          this.$Progress.fail();
        }
      }, 2000);
    },
    async dashboardWatcher(newValue) {
      this.$Progress.start();

      if (this.dashboardTimer) {
        clearTimeout(this.dashboardTimer);
        this.dashboardTimer = null;
      }

      this.dashboardTimer = setTimeout(async () => {
        try {
          await changeSetting('dashboard', newValue);
          this.$Progress.finish();
        } catch (error) {
          this.$toast.error(error.message);
          this.$Progress.fail();
        }
      }, 2000);
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
</style>
