<template lang="pug">
.w-100.h-100
  vue-progress-bar
  .loader-bg(v-if="loadingRestart")
    .loader
  .d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
    b-spinner.text-color-primary
  transition-group(name="fade", mode="out-in", v-if="loading")
  transition-group(name="fade", mode="out-in", v-else)
    .d-flex.flex-wrap.justify-content-between(key="loaded")
      .col-12.px-0(v-if="checkLevel('admin')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.system.server.expand ? "180" : "-90"', @click="settingsLayout.system.server.expand = !settingsLayout.system.server.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.system.server.expand = !settingsLayout.system.server.expand") {{ $t("server") }}
        b-collapse(
          v-model="settingsLayout.system.server.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-12.d-flex.flex-wrap.align-content-center.justify-content-center
                  a.d-block.w-100.text-center.mb-2(:href="'https://www.npmjs.com/package/' + npmPackageName" target="_blank" :class="updateAvailable ? 'text-danger' : 'text-success'") {{ updateAvailable ? $t('update_available') : $t('up_to_date') }}
                  b-form-select.versionSelect(v-model="currentVersion" :options="availableVersions")
            b-button#updateButton.w-100.mt-3.updateButton(v-b-modal.updateModal @click="onBeforeUpdate" :class="loadingUpdate || loadingRestart ? 'btnError' : 'btnNoError'" :disabled="loadingUpdate || loadingRestart") 
              span(v-if="loadingUpdate") 
                b-spinner(style="color: #fff" type="grow" small)
              span(v-else) {{ `${$t('update')} & ${$t('restart')}` }}
            b-modal#updateModal.updateModal(
              centered
              scrollable
              ref="updateModal"
              :title="$t('release_notes')",
              :cancel-title="$t('cancel')",
              :ok-title="`${$t('update')} & ${$t('restart')}`",
              ok-variant="primary",
              size="lg"
              @ok="onUpdate"
            )
              b-spinner.text-color-primary.d-block.mx-auto(v-if="!changelog", style="position: relative; top: calc(50% - 16px)")
              vue-markdown.changelog(v-else) {{ changelog }}
            b-button#restartButton.w-100.mt-3.restartButton(v-b-modal.restartModal :class="loadingRestart || loadingUpdate ? 'btnError' : 'btnNoError'" :disabled="loadingRestart || loadingUpdate") 
              span(v-if="loadingRestart") 
                b-spinner(style="color: #fff" type="grow" small)
              span(v-else) {{ $t('restart') }}
            b-modal#restartModal.restartModal(
              centered
              scrollable
              ref="restartModal"
              :title="$t('restart_confirm')",
              :cancel-title="$t('cancel')",
              :ok-title="$t('restart')",
              ok-variant="primary",
              size="sm"
              @ok="onRestart"
            )
              .w-100.text-center {{ $t('restart_confirm_text').replace('@', npmPackageName) }}
</template>

<script>
import { BIcon, BIconTriangleFill } from 'bootstrap-vue';
import compareVersions from 'compare-versions';
import { ToggleButton } from 'vue-js-toggle-button';
import VueMarkdown from 'vue-markdown';

import { getConfig } from '@/api/config.api';
import { getChangelog, getPackage, restartSystem, updateSystem } from '@/api/system.api';

import localStorageMixin from '@/mixins/localstorage.mixin';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'SettingsConfig',
  components: {
    BIcon,
    BIconTriangleFill,
    ToggleButton,
    VueMarkdown,
  },
  mixins: [localStorageMixin],
  data() {
    return {
      availableVersions: [],
      changelog: '',
      currentVersion: null,
      error: false,
      latestVersion: null,
      loading: true,
      loadingRestart: false,
      loadingUpdate: false,
      npmPackageName: 'camera.ui',
      serviceMode: false,
      updateAvailable: false,
    };
  },
  async created() {
    try {
      const config = await getConfig();

      this.serviceMode = config.data.serviceMode;
      this.currentVersion = config.data.version;

      let currentDistTag = this.currentVersion.split('-')[1];

      if (!currentDistTag) {
        currentDistTag = 'latest';
      } else {
        currentDistTag = currentDistTag.split('.')[0];
      }

      const pkg = await getPackage();
      const distTags = pkg.data['dist-tags'];
      const versions = Object.keys(pkg.data.versions).reverse();

      versions.forEach((version) => {
        let versionDistTag = version.split('-')[1];

        if (versionDistTag) {
          //alpha,beta,test
          versionDistTag = versionDistTag.split('.')[0];

          const distTagExist = this.availableVersions.some((v) => {
            let vDistTag = (v.value ? v.value : v).split('-')[1];

            if (vDistTag) {
              vDistTag = vDistTag.split('.')[0];

              if (vDistTag === versionDistTag) {
                return true;
              }
            }
          });

          if (!distTagExist) {
            this.availableVersions.push(version);
          }
        } else {
          //latest
          if (version === distTags.latest) {
            this.availableVersions.push({ value: version, text: `${version}-latest` });
            const versionExist = this.availableVersions.some((v) => (v.value || v) === this.currentVersion);

            if (version !== this.currentVersion && !versionExist) {
              this.availableVersions.push(this.currentVersion);
            }
          } else {
            this.availableVersions.push(version);
          }
        }
      });

      const relatedVersions = this.availableVersions.filter((version) => {
        const v = version.value ? version.value : version;

        if (currentDistTag !== 'latest' && v.includes(currentDistTag)) {
          return version;
        } else if (currentDistTag === 'latest' && !v.includes('-')) {
          return version;
        }
      });

      this.npmPackageName = pkg.data.name;
      this.latestVersion = relatedVersions[0];
      this.updateAvailable = compareVersions.compare(this.latestVersion, this.currentVersion, '>');

      this.loading = false;
    } catch (err) {
      console.log(err.message);
      this.$toast.error(err.message);
    }
  },
  methods: {
    async onRestart() {
      const restartButton = document.getElementById('restartButton');
      restartButton.blur();

      if (this.loadingRestart) {
        return;
      }

      this.loadingRestart = true;

      //this.$toast.success(this.$t('system_restart_initiated'));

      try {
        await restartSystem();
        localStorage.setItem('restarted', true);
      } catch (error) {
        this.$toast.error(error.message);
        this.loadingRestart = false;
      }
    },
    async onBeforeUpdate() {
      const response = await getChangelog(`?version=${this.currentVersion}`);
      this.changelog = response.data;
    },
    async onUpdate() {
      const restartButton = document.getElementById('restartButton');
      restartButton.blur();

      const updateButton = document.getElementById('updateButton');
      updateButton.blur();

      if (this.loadingUpdate || this.loadingRestart) {
        return;
      }

      this.loadingUpdate = true;
      this.loadingRestart = true;

      try {
        this.$toast.success(this.$t('system_update_initiated'));
        await updateSystem(`?version=${this.currentVersion}`);
        localStorage.setItem('updated', true);
        //this.$toast.success(this.$t('system_successfully_updated'));

        await timeout(500);

        this.$toast.success(this.$t('system_restart_initiated'));
        await restartSystem();
        localStorage.setItem('restarted', true);
        //this.$toast.success(this.$t('system_successfully_restarted'));

        await timeout(500);

        this.updateAvailable = false;
      } catch (error) {
        this.$toast.error(error.message);
        this.loadingUpdate = false;
        this.loadingRestart = false;
      }
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

.card {
  background-color: var(--third-bg-color);
  color: var(--primary-font-color);
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

.restartButton,
.updateButton {
  height: 40px;
  transition: 0.3s all;
}

select .versionSelect {
  text-align: center;
  text-align-last: center;
  -moz-text-align-last: center;
}

.loader-bg {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--primary-bg-color);
  z-index: 9999;
}

.loader {
  color: var(--primary-color);
  font-size: 90px;
  text-indent: -9999em;
  overflow: hidden;
  width: 1em;
  height: 1em;
  border-radius: 50%;
  margin: 72px auto;
  position: relative;
  -webkit-transform: translateZ(0);
  -ms-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-animation: load6 1.7s infinite ease, round 1.7s infinite ease;
  animation: load6 1.7s infinite ease, round 1.7s infinite ease;
  top: calc(50% - 1em);
}
@-webkit-keyframes load6 {
  0% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
  5%,
  95% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
  10%,
  59% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.087em -0.825em 0 -0.42em, -0.173em -0.812em 0 -0.44em,
      -0.256em -0.789em 0 -0.46em, -0.297em -0.775em 0 -0.477em;
  }
  20% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.338em -0.758em 0 -0.42em, -0.555em -0.617em 0 -0.44em,
      -0.671em -0.488em 0 -0.46em, -0.749em -0.34em 0 -0.477em;
  }
  38% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.377em -0.74em 0 -0.42em, -0.645em -0.522em 0 -0.44em, -0.775em -0.297em 0 -0.46em,
      -0.82em -0.09em 0 -0.477em;
  }
  100% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
}
@keyframes load6 {
  0% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
  5%,
  95% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
  10%,
  59% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.087em -0.825em 0 -0.42em, -0.173em -0.812em 0 -0.44em,
      -0.256em -0.789em 0 -0.46em, -0.297em -0.775em 0 -0.477em;
  }
  20% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.338em -0.758em 0 -0.42em, -0.555em -0.617em 0 -0.44em,
      -0.671em -0.488em 0 -0.46em, -0.749em -0.34em 0 -0.477em;
  }
  38% {
    box-shadow: 0 -0.83em 0 -0.4em, -0.377em -0.74em 0 -0.42em, -0.645em -0.522em 0 -0.44em, -0.775em -0.297em 0 -0.46em,
      -0.82em -0.09em 0 -0.477em;
  }
  100% {
    box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
  }
}
@-webkit-keyframes round {
  0% {
    -webkit-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
@keyframes round {
  0% {
    -webkit-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
.changelog >>> a {
  color: var(--primary-color);
}
</style>
