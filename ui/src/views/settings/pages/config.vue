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
          v-model="settingsLayout.config.server.expand",
          id="expandServer"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center
                  a.d-block.w-100.text-center(:href="npmLink" target="_blank" :class="updateAvailable ? 'text-danger' : 'text-success'") {{ updateAvailable ? $t('update_available') : $t('up_to_date') }}
                  div.w-100.text-center(style="font-size: 14px") v{{ latestVersion }}
</template>

<script>
import { BIcon, BIconTriangleFill } from 'bootstrap-vue';
import compareVersions from 'compare-versions';
import { ToggleButton } from 'vue-js-toggle-button';

import { getConfig } from '@/api/config.api';

import localStorageMixin from '@/mixins/localstorage.mixin';

export default {
  name: 'SettingsConfig',
  components: {
    BIcon,
    BIconTriangleFill,
    ToggleButton,
  },
  mixins: [localStorageMixin],
  data() {
    return {
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
      const config = await getConfig();
      this.currentVersion = config.data.version;

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
  methods: {},
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
