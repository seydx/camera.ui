<template lang="pug">
.w-100.h-100
  vue-progress-bar
  .d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
    b-spinner.text-color-primary
  transition-group(name="fade", mode="out-in", v-if="loading")
  transition-group(name="fade", mode="out-in", v-else)
    .d-flex.flex-wrap.justify-content-between(key="loaded")
      .col-12.z-index-2(v-if="checkLevel('settings:general:edit')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.general.automation.expand ? "180" : "-90"', @click="settingsLayout.general.automation.expand = !settingsLayout.general.automation.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.general.automation.expand = !settingsLayout.general.automation.expand") {{ $t("automation") }}
        b-collapse(
          v-model="settingsLayout.general.automation.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="general.automation.active"
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    :aria-expanded="general.automation.active ? 'true' : 'false'"
                    aria-controls="automation"
                    @change="function(){restartAutomation = general.automation.active ? true : false; stopAutomation = general.automation.active ? false : true;}"
                  )
              b-collapse(
                v-model="general.automation.active"
              )
                hr.hr-underline(v-if="general.automation.active")
                .row(v-if="general.automation.active")
                  .col-8.d-flex.flex-wrap.align-content-center {{ $t("at_home") }}
                  .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="general.automation.atHome"
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true",
                      @change="function(){restartAutomation = true; stopAutomation = false;}"
                    )
                hr.hr-underline(v-if="general.automation.active")
                .row(v-if="general.automation.active")
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("exclude") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    multiselect(
                      v-model="general.automation.exclude",
                      :options="cameras.map(camera => { return camera.name })",
                      :searchable="false",
                      :close-on-select="false",
                      :show-labels="false"
                      :placeholder="$t('select')",
                      :multiple="true",
                      :limit="2"
                      @input="function(){restartAutomation = true; stopAutomation = false;}"
                    )
                      template(slot="noOptions")
                        strong {{ $t("empty") }}
                hr.hr-underline(v-if="general.automation.active")
                .row.z-index-3(v-if="general.automation.active")
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("automation_from") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-input-group
                      b-form-input(
                        id="automationStartTime"
                        v-model="general.automation.startTime"
                        type="text"
                        placeholder="HH:mm"
                        @change="function(){restartAutomation = true; stopAutomation = false;}"
                      )
                      b-input-group-append
                        b-form-timepicker(
                          v-model="general.automation.startTime"
                          button-only
                          no-close-button
                          right
                          aria-controls="automationStartTime"
                          class="timePicker"
                          @input="function(){restartAutomation = true; stopAutomation = false;}"
                        )
                hr.hr-underline(v-if="general.automation.active")
                .row.z-index-2(v-if="general.automation.active")
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("automation_to") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-input-group
                      b-form-input(
                        id="automationEndTime"
                        v-model="general.automation.endTime"
                        type="text"
                        placeholder="HH:mm"
                        @change="function(){restartAutomation = true; stopAutomation = false;}"
                      )
                      b-input-group-append
                        b-form-timepicker(
                          v-model="general.automation.endTime"
                          button-only
                          no-close-button
                          right
                          aria-controls="automationEndTime"
                          class="timePicker"
                          @input="function(){restartAutomation = true; stopAutomation = false;}"
                        )
      b-collapse.col-12.mt-2.z-index-2(
        :visible="!general.automation.active"
      )
        .z-index-1(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel('settings:general:edit')")
          b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.general.general.expand ? "180" : "-90"', @click="settingsLayout.general.general.expand = !settingsLayout.general.general.expand")
          h5.cursor-pointer.settings-box-top(@click="settingsLayout.general.general.expand = !settingsLayout.general.general.expand") {{ $t("general") }}
          b-collapse(
            v-model="settingsLayout.general.general.expand"
          )
            div.mt-2.mb-4
              .settings-box.container
                .row
                  .col-8.d-flex.flex-wrap.align-content-center {{ $t("at_home") }}
                  .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="general.atHome"
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true",
                      @change="function(){restartAutomation = false; stopAutomation = true;}"
                    )
                b-collapse(
                  v-model="general.atHome"
                )
                  hr.hr-underline
                  .row
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("exclude") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                      multiselect(
                        v-model="general.exclude",
                        :options="cameras.map(camera => { return camera.name })",
                        :searchable="false",
                        :close-on-select="false",
                        :show-labels="false"
                        :placeholder="$t('select')",
                        :multiple="true",
                        :limit="2"
                        @input="function(){restartAutomation = false; stopAutomation = true;}"
                      )
                        template(slot="noOptions")
                          strong {{ $t("empty") }}
      .col-12.mt-2(data-aos="fade-up" data-aos-duration="1000", v-if="!uiConfig || (uiConfig && uiConfig.theme === 'auto')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.general.themes.expand ? "180" : "-90"', @click="settingsLayout.general.themes.expand = !settingsLayout.general.themes.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.general.themes.expand = !settingsLayout.general.themes.expand") {{ $t("themes") }}
        b-collapse(
          v-model="settingsLayout.general.themes.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row(v-if="supportMatchMedia")
                .col-8.d-flex.flex-wrap.align-content-center {{ $t("auto_darkmode") }}
                .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button.auto-darkmode-toggle(
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    v-model="autoDarkmode"
                    @input="switchAutoDarkmode"
                    @change="function(){restartAutomation = false; stopAutomation = false;}"
                  )
              hr.hr-underline(v-if="supportMatchMedia")
              .row(v-if="supportMatchMedia && !autoDarkmode")
                .col-8.d-flex.flex-wrap.align-content-center {{ $t("darkmode") }}
                .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button.darkmode-toggle(
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    v-model="darkmode"
                    @input="switchDarkmode"
                    @change="function(){restartAutomation = false; stopAutomation = false;}"
                  )
              hr.hr-underline(v-if="supportMatchMedia && !autoDarkmode")
              .row
                .col-4.d-flex.flex-wrap.align-content-center {{ $t("themes") }}
                .col-8.text-right
                  input#switch-pink.theme-switches.switch-pink(@input="switchTheme('pink')", type="radio", name="theme-group")
                  label.m-0(for="switch-pink")
                  input#switch-purple.theme-switches.switch-purple(@input="switchTheme('purple')", type="radio", name="theme-group")
                  label.m-0(for="switch-purple")
                  input#switch-blue.theme-switches.switch-blue(@input="switchTheme('blue')", type="radio", name="theme-group")
                  label.m-0(for="switch-blue")
                  input#switch-blgray.theme-switches.switch-blgray(@input="switchTheme('blgray')", type="radio", name="theme-group")
                  label.m-0(for="switch-blgray")
                  input#switch-brown.theme-switches.switch-brown(@input="switchTheme('brown')", type="radio", name="theme-group")
                  label.m-0(for="switch-brown")
                  input#switch-orange.theme-switches.switch-orange(@input="switchTheme('orange')", type="radio", name="theme-group")
                  label.m-0(for="switch-orange")
                  input#switch-green.theme-switches.switch-green(@input="switchTheme('green')", type="radio", name="theme-group")
                  label.m-0(for="switch-green")
                  input#switch-gray.theme-switches.switch-gray(@input="switchTheme('gray')", type="radio", name="theme-group")
                  label.m-0(for="switch-gray")
      .col-12.mt-2(data-aos="fade-up" data-aos-duration="1000" v-if="checkLevel('settings:general:edit')")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.general.rooms.expand ? "180" : "-90"', @click="settingsLayout.general.rooms.expand = !settingsLayout.general.rooms.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.general.rooms.expand = !settingsLayout.general.rooms.expand") {{ $t("rooms") }}
        b-collapse(
          v-model="settingsLayout.general.rooms.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-10.d-flex.flex-wrap.align-content-center
                  b-form-input(
                    type='text',
                    :placeholder="$t('room_name')",
                    v-model="form.newRoom",
                    :state="roomState",
                    v-disable-leading-space
                    @change="function(){restartAutomation = false; stopAutomation = false;}"
                  )
                .col.d-flex.flex-wrap.align-content-center.justify-content-end.align-content-center.pl-0
                  b-link.text-success
                    b-icon(icon="plus-circle-fill", @click="addRoom()")
              hr.hr-underline
              div(v-for="(room, index) in general.rooms" :key="room")
                .row
                  .col-10
                    span.fs-6 {{ room === 'Standard' ? $t("standard") : room }}
                  .col.d-flex.flex-wrap.align-content-center.justify-content-end.align-content-center.pl-0
                    b-link.text-color-danger
                      b-icon(icon="x-circle-fill", v-if="room !== 'Standard'", @click="removeRoom(room, index)")
                hr.hr-underline(v-if="index < general.rooms.length - 1")
</template>

<script>
import { BIcon, BIconPlusCircleFill, BIconTriangleFill, BIconXCircleFill } from 'bootstrap-vue';
import Multiselect from 'vue-multiselect';
import 'vue-multiselect/dist/vue-multiselect.min.css';
import { ToggleButton } from 'vue-js-toggle-button';

import { getSetting, changeSetting } from '@/api/settings.api';
import localStorageMixin from '@/mixins/localstorage.mixin';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'SettingsGeneral',
  components: {
    BIcon,
    BIconPlusCircleFill,
    BIconTriangleFill,
    BIconXCircleFill,
    Multiselect,
    ToggleButton,
  },
  mixins: [localStorageMixin],
  data() {
    return {
      autoDarkmode: false,
      cameras: [],
      darkmode: false,
      form: {
        newRoom: '',
      },
      general: {
        exclude: [],
        rooms: [],
      },
      generalTimer: null,
      loading: true,
      restartAutomation: false,
      stopAutomation: false,
      supportMatchMedia: false,
    };
  },
  computed: {
    roomState() {
      const state =
        this.form.newRoom.length > 0 ? (!this.general.rooms.includes(this.form.newRoom) ? true : false) : null;
      return state;
    },
    uiConfig() {
      return this.$store.state.config.ui;
    },
  },
  async mounted() {
    try {
      if (this.checkLevel('settings:general:access')) {
        const general = await getSetting('general');
        this.general = general.data;
      }

      if (this.checkLevel('settings:cameras:access')) {
        const cameras = await getSetting('cameras');
        this.cameras = cameras.data;
      }

      this.$watch('general', this.generalWatcher, { deep: true });

      this.supportMatchMedia = window.matchMedia;
      this.loading = false;
      await timeout(100);

      const togglePinkSwitch = document.querySelector('.switch-pink');
      const togglePurpleSwitch = document.querySelector('.switch-purple');
      const toggleBlueSwitch = document.querySelector('.switch-blue');
      const toggleBlgraySwitch = document.querySelector('.switch-blgray');
      const toggleBrownSwitch = document.querySelector('.switch-brown');
      const toggleOrangeSwitch = document.querySelector('.switch-orange');
      const toggleGreenSwitch = document.querySelector('.switch-green');
      const toggleGraySwitch = document.querySelector('.switch-gray');

      const currentColorTheme = localStorage.getItem('theme-color')
        ? localStorage.getItem('theme-color')
        : togglePinkSwitch
        ? togglePinkSwitch.click()
        : 'pink';

      this.autoDarkmode = localStorage.getItem('darkmode') === 'auto';
      this.darkmode = localStorage.getItem('theme') === 'dark';

      if (currentColorTheme === 'pink' && togglePinkSwitch) {
        togglePinkSwitch.checked = true;
      } else if (currentColorTheme === 'purple' && togglePurpleSwitch) {
        togglePurpleSwitch.checked = true;
      } else if (currentColorTheme === 'blue' && toggleBlueSwitch) {
        toggleBlueSwitch.checked = true;
      } else if (currentColorTheme === 'blgray' && toggleBlgraySwitch) {
        toggleBlgraySwitch.checked = true;
      } else if (currentColorTheme === 'brown' && toggleBrownSwitch) {
        toggleBrownSwitch.checked = true;
      } else if (currentColorTheme === 'orange' && toggleOrangeSwitch) {
        toggleOrangeSwitch.checked = true;
      } else if (currentColorTheme === 'green' && toggleGreenSwitch) {
        toggleGreenSwitch.checked = true;
      } else if (currentColorTheme === 'gray' && toggleGraySwitch) {
        toggleGraySwitch.checked = true;
      }
    } catch (err) {
      this.$toast.error(err.message);
    }
  },
  methods: {
    addRoom() {
      if (this.roomState) {
        this.general.rooms.push(this.form.newRoom);
        this.$toast.success(this.$t('successfully_created'));
      } else if (this.roomState === null) {
        this.$toast.error(this.$t('no_roomname_defined'));
      } else {
        this.$toast.error(this.$t('room_already_exists'));
      }
    },
    async generalWatcher(newValue) {
      this.$Progress.start();

      if (this.generalTimer) {
        clearTimeout(this.generalTimer);
        this.generalTimer = null;
      }

      const startTime = this.general.automation.startTime || '08:00:00';
      const endTime = this.general.automation.endTime || '17:00:00';

      if (startTime.split(':').length > 2) {
        this.general.automation.startTime = startTime.split(':').slice(0, -1).join(':');
      }

      if (endTime.split(':').length > 2) {
        this.general.automation.endTime = endTime.split(':').slice(0, -1).join(':');
      }

      this.generalTimer = setTimeout(async () => {
        try {
          await changeSetting(
            'general',
            newValue,
            `?restartAutomation=${this.restartAutomation}&stopAutomation=${this.stopAutomation}`
          );
          this.$Progress.finish();
        } catch (error) {
          this.$toast.error(error.message);
          this.$Progress.fail();
        }
      }, 2000);
    },
    matchMediaListener(event) {
      const autoDarkmode = localStorage.getItem('darkmode') === 'auto';

      if (autoDarkmode) {
        if (event.matches) {
          localStorage.setItem('theme', 'dark');
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          localStorage.setItem('theme', 'light');
          document.documentElement.setAttribute('data-theme', 'light');
        }
      }
    },
    removeRoom(room, index) {
      this.$toast.success(this.$t('successfully_removed'));
      this.$delete(this.general.rooms, index);
    },
    switchAutoDarkmode(state) {
      localStorage.setItem('darkmode', state ? 'auto' : 'manual');

      if (state) {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          localStorage.setItem('theme', 'dark');
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          localStorage.setItem('theme', 'light');
          document.documentElement.setAttribute('data-theme', 'light');
        }

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.matchMediaListener);
      } else {
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        this.darkmode = currentTheme === 'dark';

        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this.matchMediaListener);
      }
    },
    switchDarkmode(state) {
      document.documentElement.dataset.theme = state ? 'dark' : 'light';
      localStorage.setItem('theme', state ? 'dark' : 'light');
    },
    switchTheme(theme) {
      document.documentElement.dataset.themeColor = theme;
      localStorage.setItem('theme-color', theme);

      const images = document.querySelectorAll('.theme-img');

      for (const img of images) {
        let imgSource = img.src;
        imgSource = imgSource.split('/');
        imgSource = imgSource[imgSource.length - 1].split('.png')[0].split('.')[0].split('@')[0];

        img.src = require(`@/assets/img/${imgSource}@${theme}.png`);
      }
    },
  },
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease-out;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

[type='radio'].theme-switches:checked + label,
[type='radio'].theme-switches:not(:checked) + label {
  width: auto;
}

[type='radio'].theme-switches:checked,
[type='radio'].theme-switches:not(:checked) {
  position: absolute;
  left: -9999px;
}

[type='radio'].theme-switches:checked + label,
[type='radio'].theme-switches:not(:checked) + label {
  position: relative;
  padding-left: 25px;
  cursor: pointer;
  line-height: 20px;
  display: inline-block;
  color: #666;
  top: -12px;
}

[type='radio'].theme-switches:checked + label:before,
[type='radio'].theme-switches:not(:checked) + label:before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 18px;
  height: 18px;
  border-radius: 100%;
}

[type='radio'].theme-switches:checked.switch-pink + label:before,
[type='radio'].theme-switches:not(:checked).switch-pink + label:before {
  background: rgb(209, 32, 73);
}

[type='radio'].theme-switches:checked.switch-purple + label:before,
[type='radio'].theme-switches:not(:checked).switch-purple + label:before {
  background: rgb(88, 22, 125);
}

[type='radio'].theme-switches:checked.switch-blue + label:before,
[type='radio'].theme-switches:not(:checked).switch-blue + label:before {
  background: rgb(10, 132, 255);
}

[type='radio'].theme-switches:checked.switch-blgray + label:before,
[type='radio'].theme-switches:not(:checked).switch-blgray + label:before {
  background: rgb(96, 125, 139);
}

[type='radio'].theme-switches:checked.switch-brown + label:before,
[type='radio'].theme-switches:not(:checked).switch-brown + label:before {
  background: rgb(121, 85, 72);
}

[type='radio'].theme-switches:checked.switch-orange + label:before,
[type='radio'].theme-switches:not(:checked).switch-orange + label:before {
  background: rgb(255, 149, 0);
}

[type='radio'].theme-switches:checked.switch-green + label:before,
[type='radio'].theme-switches:not(:checked).switch-green + label:before {
  background: rgb(103, 206, 103);
}

[type='radio'].theme-switches:checked.switch-gray + label:before,
[type='radio'].theme-switches:not(:checked).switch-gray + label:before {
  background: rgb(99, 99, 102);
}

[type='radio'].theme-switches:checked.switch-pink + label:before,
[type='radio'].theme-switches:not(:checked).switch-pink + label:before {
  border: 2px solid rgb(209, 32, 73);
}

[type='radio'].theme-switches:checked.switch-purple + label:before,
[type='radio'].theme-switches:not(:checked).switch-purple + label:before {
  border: 2px solid rgb(88, 22, 125);
}

[type='radio'].theme-switches:checked.switch-blue + label:before,
[type='radio'].theme-switches:not(:checked).switch-blue + label:before {
  border: 2px solid rgb(10, 132, 255);
}

[type='radio'].theme-switches:checked.switch-blgray + label:before,
[type='radio'].theme-switches:not(:checked).switch-blgray + label:before {
  border: 2px solid rgb(96, 125, 139);
}

[type='radio'].theme-switches:checked.switch-brown + label:before,
[type='radio'].theme-switches:not(:checked).switch-brown + label:before {
  border: 2px solid rgb(121, 85, 72);
}

[type='radio'].theme-switches:checked.switch-orange + label:before,
[type='radio'].theme-switches:not(:checked).switch-orange + label:before {
  border: 2px solid rgb(255, 149, 0);
}

[type='radio'].theme-switches:checked.switch-green + label:before,
[type='radio'].theme-switches:not(:checked).switch-green + label:before {
  border: 2px solid rgb(103, 206, 103);
}

[type='radio'].theme-switches:checked.switch-gray + label:before,
[type='radio'].theme-switches:not(:checked).switch-gray + label:before {
  border: 2px solid rgb(99, 99, 102);
}

[type='radio'].theme-switches:checked + label:after,
[type='radio'].theme-switches:not(:checked) + label:after {
  content: '';
  width: 21px;
  height: 21px;
  position: absolute;
  top: -1px;
  left: -1px;
  border-radius: 100%;
  -webkit-transition: all 0.2s ease;
  -o-transition: all 0.2s ease;
  transition: all 0.2s ease;
}

[type='radio'].theme-switches:checked.switch-pink + label:after,
[type='radio']:not(:checked) + label:after {
  border: 5px solid rgb(125, 19, 44);
}

[type='radio'].theme-switches:checked.switch-purple + label:after,
[type='radio']:not(:checked) + label:after {
  border: 5px solid rgb(53, 2, 82);
}

[type='radio'].theme-switches:checked.switch-blue + label:after,
[type='radio'].theme-switches:not(:checked) + label:after {
  border: 5px solid rgb(6, 79, 153);
}

[type='radio'].theme-switches:checked.switch-blgray + label:after,
[type='radio'].theme-switches:not(:checked) + label:after {
  border: 5px solid rgb(64, 85, 95);
}

[type='radio'].theme-switches:checked.switch-brown + label:after,
[type='radio'].theme-switches:not(:checked) + label:after {
  border: 5px solid rgb(82, 56, 46);
}

[type='radio'].theme-switches:checked.switch-orange + label:after,
[type='radio'].theme-switches:not(:checked) + label:after {
  border: 5px solid rgb(189, 110, 0);
}

[type='radio'].theme-switches:checked.switch-green + label:after,
[type='radio']:not(:checked) + label:after {
  border: 5px solid rgb(61, 124, 61);
}

[type='radio'].theme-switches:checked.switch-gray + label:after,
[type='radio'].theme-switches:not(:checked) + label:after {
  border: 5px solid rgb(59, 59, 61);
}

[type='radio'].theme-switches:not(:checked) + label:after {
  opacity: 0;
  -webkit-transform: scale(0);
  -ms-transform: scale(0);
  transform: scale(0);
}

[type='radio'].theme-switches:checked + label:after {
  opacity: 1;
  -webkit-transform: scale(1);
  -ms-transform: scale(1);
  transform: scale(1);
}

.timePicker >>> .dropdown-menu {
  background: var(--secondary-bg-hover-color);
  border: 1px solid var(--third-bg-color);
  -webkit-box-shadow: 0px 0px 7px -2px rgb(0 0 0 / 50%);
  box-shadow: 0px 0px 7px -4px rgb(0 0 0 / 50%);
}

.timePicker >>> button {
  border-top-left-radius: 0px !important;
  border-bottom-left-radius: 0px !important;
}

.timePicker >>> .bi-chevron-up,
.timePicker >>> .bi-circle-fill {
  color: var(--primary-font-color) !important;
}

.timePicker >>> .form-control.focus {
  border-color: var(--trans-bg-color-3);
  box-shadow: 0 0 0 0.2rem var(--trans-bg-color-3);
}

.timePicker >>> .btn-secondary {
  background-color: var(--third-bg-color);
  color: var(--font-primary-color);
}
</style>
