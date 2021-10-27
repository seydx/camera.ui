<template lang="pug">
.w-100.h-100
  .d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
    b-spinner.text-color-primary
  transition-group(name="fade", mode="out-in", v-if="loading")
  transition-group(name="fade", mode="out-in", v-else)
    .d-flex.flex-wrap.justify-content-between(key="loaded")
      .col-12(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel('settings:camview:edit')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.camview.camview.expand ? "180" : "-90"', @click="settingsLayout.camview.camview.expand = !settingsLayout.camview.camview.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.camview.camview.expand = !settingsLayout.camview.camview.expand") {{ $t("camview") }}
        b-collapse(
          v-model="settingsLayout.camview.camview.expand",
          id="expandCamview"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-12.d-flex.flex-wrap.align-content-center {{ $t("snapshot_timer") }}
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                  b-form-select(
                    v-model="camview.refreshTimer"
                    :options="refreshTimer"
                  )
      .col-12.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="cameras.length && checkLevel(['settings:camview:edit', 'settings:cameras:edit'])")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.camview.favourites.expand ? "180" : "-90"', @click="settingsLayout.camview.favourites.expand = !settingsLayout.camview.favourites.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.camview.favourites.expand = !settingsLayout.camview.favourites.expand") {{ $t("favourites") }}
        b-collapse(
          v-model="settingsLayout.camview.favourites.expand",
          id="expandFavourites"
        )
          div.mt-2.mb-4(v-for="camera in cameras" :key="camera.name" data-aos="fade-up" data-aos-duration="1000")
            b-icon.cursor-pointer.expandTriangleCamera(icon="triangle-fill", aria-hidden="true", :rotate='camera.camview.expand ? "180" : "-90"', @click="camera.camview.expand = !camera.camview.expand")
            .settings-box-header(@click="camera.camview.expand = !camera.camview.expand") {{ camera.name }}
            b-collapse(
              v-model="camera.camview.expand"
            )
              .settings-box.container.no-radius-top
                .row
                  .col-8.d-flex.flex-wrap.align-content-center {{ $t("favourite") }}
                  .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="camera.camview.favourite",
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true"
                    )
                hr.hr-underline(v-if="camera.camview.favourite")
                .row(v-if="camera.camview.favourite")
                  .col-8.d-flex.flex-wrap.align-content-center {{ $t("livestream") }}
                  .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="camera.camview.live",
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true"
                    )
</template>

<script>
import { BIcon, BIconTriangleFill } from 'bootstrap-vue';
import { ToggleButton } from 'vue-js-toggle-button';

import { getSetting, changeSetting } from '@/api/settings.api';
import localStorageMixin from '@/mixins/localstorage.mixin';

export default {
  name: 'SettingsCamview',
  components: {
    BIcon,
    BIconTriangleFill,
    ToggleButton,
  },
  mixins: [localStorageMixin],
  data() {
    return {
      cameras: [],
      camview: {},
      camviewTimer: null,
      loading: true,
      refreshTimer: [10, 20, 30, 40, 50, 60],
      settingsLayout: {},
    };
  },
  watch: {
    cameras: {
      async handler(newValue) {
        if (!this.loading) {
          if (this.camviewTimer) {
            clearTimeout(this.camviewTimer);
            this.camviewTimer = null;
          }

          this.camviewTimer = setTimeout(async () => {
            try {
              await changeSetting('cameras', newValue, '?stopStream=true');
            } catch (error) {
              this.$toast.error(error.message);
            }
          }, 1500);
        }
      },
      deep: true,
    },
    camview: {
      async handler(newValue) {
        if (!this.loading) {
          try {
            await changeSetting('camview', newValue, '?stopStream=true');
          } catch (error) {
            this.$toast.error(error.message);
          }
        }
      },
      deep: true,
    },
  },
  async created() {
    try {
      if (this.checkLevel('settings:camview:access')) {
        const camview = await getSetting('camview');
        this.camview = camview.data;
      }

      if (this.checkLevel('settings:cameras:access')) {
        const cameras = await getSetting('cameras');
        this.cameras = cameras.data;
      }

      this.loading = false;
    } catch (err) {
      this.$toast.error(err.message);
    }
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
