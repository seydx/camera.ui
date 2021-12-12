<template lang="pug">
.w-100.h-100
  vue-progress-bar
  .d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
    b-spinner.text-color-primary
  transition-group(name="fade", mode="out-in", v-if="loading")
  transition-group(name="fade", mode="out-in", v-else)
    .d-flex.flex-wrap.justify-content-between(key="loaded")
      .col-12.px-0(v-if="checkLevel(['settings:cameras:edit'])")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.cameras.aws.expand ? "180" : "-90"', @click="settingsLayout.cameras.aws.expand = !settingsLayout.cameras.aws.expand")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.cameras.aws.expand = !settingsLayout.cameras.aws.expand") {{ $t("aws") }}
        b-collapse(
          v-model="settingsLayout.cameras.aws.expand"
        )
          div.mt-2.mb-4
            .settings-box.container
              .row
                .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="aws.active"
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true",
                    :aria-expanded="aws.active ? 'true' : 'false'"
                    aria-controls="aws"
                  )
              b-collapse(
                v-model="aws.active"
              )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_access_key_id") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='text',
                      :placeholder="$t('aws_access_key_id')",
                      v-model="aws.accessKeyId"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_secret_access_key") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='text',
                      :placeholder="$t('aws_secret_access_key')",
                      v-model="aws.secretAccessKey"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_region") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='text',
                      :placeholder="$t('aws_region')",
                      v-model="aws.region"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_contingent_total") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='number',
                      :min="0",
                      :max="10000",
                      :placeholder="$t('aws_contingent_total')",
                      v-model="aws.contingent_total"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_contingent_left") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='number',
                      :disabled="true"
                      v-model="aws.contingent_left"
                      style="background: var(--third-bg-color) !important"
                    )
                hr.hr-underline
                .row
                  .col-12.d-flex.flex-wrap.align-content-center {{ $t("aws_last_rekognition") }}
                  .col-12.d-flex.flex-wrap.align-content-center.justify-content-end.mt-3
                    b-form-input(
                      type='text',
                      :disabled="true"
                      v-model="aws.last_rekognition"
                      style="background: var(--third-bg-color) !important"
                    )
      .col-12.mt-2.px-0(:class="index ? 'mt-2' : ''" v-if="checkLevel(['settings:cameras:edit'])" v-for="(camera, index) in cameras" :key="camera.name" data-aos="fade-up" data-aos-duration="1000")
        b-icon.cursor-pointer.expandTriangle(icon="triangle-fill", aria-hidden="true", :rotate='settingsLayout.cameras.cameras.camerasExpands[camera.name] ? "180" : "-90"', @click="settingsLayout.cameras.cameras.camerasExpands[camera.name] = !settingsLayout.cameras.cameras.camerasExpands[camera.name]")
        h5.cursor-pointer.settings-box-top(@click="settingsLayout.cameras.cameras.camerasExpands[camera.name] = !settingsLayout.cameras.cameras.camerasExpands[camera.name]") {{ camera.name }}
        b-collapse(
          v-model="settingsLayout.cameras.cameras.camerasExpands[camera.name]"
        )
          div.mt-2.mb-4
            .container
              .row
                .col-4.pl-0.camera-button-col
                  b-button.w-100.camera-button.p-1(@click="actives[camera.name] = 'interface'" :class="actives[camera.name] === 'interface' ? 'camera-button-active' : ''") {{ $t('interface') }}
                .col-4.pl-0.pr-0.camera-button-col
                  b-button.w-100.camera-button.p-1(@click="actives[camera.name] = 'config'" :class="actives[camera.name] === 'config' ? 'camera-button-active' : ''") {{ $t('config') }}
                .col-4.pr-0.camera-button-col
                  b-button.w-100.camera-button.p-1(@click="actives[camera.name] = 'prebuffering'" :class="actives[camera.name] === 'prebuffering' ? 'camera-button-active' : ''") {{ $t('prebuffering') }}
            .settings-box.container.mt-2
              b-collapse.row(:visible="actives[camera.name] === 'interface'")
                .col-12
                  label.fs-6 {{ $t("room") }}
                  b-form-select(
                    v-model="camera.room"
                    :options="general.rooms",
                  )
                  hr.hr-underline
                  label.fs-6 {{ $t("video_resolution") }}
                  b-form-select(
                    v-model="camera.resolution"
                    :options="camerasResolutions"
                  )
                  hr.hr-underline
                  label.fs-6 {{ `${$t("ping_timeout")} (${$t("seconds")})` }}
                  b-form-input(
                    type='number',
                    :min="1",
                    :max="60",
                    placeholder="1",
                    v-model="camera.pingTimeout"
                    number
                  )
                  hr.hr-underline
                .col-8.d-flex.flex-wrap.align-content-center {{ $t("audio") }}
                .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                  toggle-button(
                    v-model="camera.audio",
                    color="var(--primary-color) !important",
                    :height="30",
                    :sync="true"
                  )
                .row.w-100.m-0.p-0(v-if="aws.active")
                  .col-12
                    hr.hr-underline
                  .col-8.d-flex.flex-wrap.align-content-center {{ $t("rekognition") }}
                  .col-4.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="camera.rekognition.active",
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true"
                    )
                  b-collapse.w-100(
                    v-model="camera.rekognition.active"
                  )
                    .col-12
                      hr.hr-underline
                    .col-12
                      label.fs-6 {{ `${$t("confidence")} %` }}
                      b-form-input(
                        type='number',
                        :min="0",
                        :max="100",
                        :placeholder="`${$t('confidence')} %`",
                        v-model="camera.rekognition.confidence"
                      )
                      hr.hr-underline
                      label.fs-6 {{ $t("labels") }}
                      b-form-input(
                        type='text',
                        :placeholder="$t('labels')",
                        v-model="camera.rekognition.labels"
                      )
              div(v-for="(cam, i) in config.cameras" :key="cam.name" v-if="cam.name === camera.name && checkLevel('admin')")
                b-collapse.row(:visible="actives[camera.name] === 'config'")
                  .row.w-100.p-0.m-0
                    .col-7.d-flex.flex-wrap.align-content-center {{ $t("debug") }}
                    .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                      toggle-button(
                        v-model="cam.videoConfig.debug"
                        color="var(--primary-color) !important",
                        :height="30",
                        :sync="true",
                        :aria-expanded="cam.videoConfig.debug ? 'true' : 'false'"
                        aria-controls="debug"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('debug_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("motion_timeout") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        placeholder=15,
                        v-model="cam.motionTimeout"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('motion_timeout_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("source") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='text',
                        v-model="cam.videoConfig.source"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('source_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("still_image_source") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='text',
                        v-model="cam.videoConfig.stillImageSource"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('still_image_source_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-7.d-flex.flex-wrap.align-content-center {{ $t("audio") }}
                    .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                      toggle-button(
                        v-model="cam.videoConfig.audio"
                        color="var(--primary-color) !important",
                        :height="30",
                        :sync="true",
                        :aria-expanded="cam.videoConfig.audio ? 'true' : 'false'"
                        aria-controls="audio"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('audio_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("max_streams") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        placeholder=4,
                        v-model="cam.videoConfig.maxStreams"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('max_streams_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("width") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        v-model="cam.videoConfig.maxWidth"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('width_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("height") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        v-model="cam.videoConfig.maxHeight"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('height_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("fps") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        v-model="cam.videoConfig.maxFPS"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('fps_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("bitrate") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        v-model="cam.videoConfig.maxBitrate"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('bitrate_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-7.d-flex.flex-wrap.align-content-center Read Rate
                    .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                      toggle-button(
                        v-model="cam.videoConfig.readRate"
                        color="var(--primary-color) !important",
                        :height="30",
                        :sync="true",
                        :aria-expanded="cam.videoConfig.readRate ? 'true' : 'false'"
                        aria-controls="readRate"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('read_rate_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("rtsp_transport") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-select(
                        v-model="cam.videoConfig.rtspTransport"
                        :options="rtspTransport"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('rtsp_transport_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("video_codec") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='text',
                        v-model="cam.videoConfig.vcodec"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('video_codec_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("audio_codec") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='text',
                        v-model="cam.videoConfig.acodec"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('audio_codec_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("timeout") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        v-model="cam.videoConfig.stimeout"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('timeout_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center Analyze Duration
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        v-model="cam.videoConfig.analyzeDuration"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('analyze_duration_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center Probe Size
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        v-model="cam.videoConfig.probeSize"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('probe_size_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center Reorder Queue Size
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        v-model="cam.videoConfig.reorderQueueSize"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('reorder_queue_size_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("max_delay") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='number',
                        v-model="cam.videoConfig.maxDelay"
                        number
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('max_delay_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("video_filter") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='text',
                        v-model="cam.videoConfig.videoFilter"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('video_filter_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("map_video") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='text',
                        v-model="cam.videoConfig.mapvideo"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('map_video_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("map_audio") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='text',
                        v-model="cam.videoConfig.mapaudio"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('map_audio_info') }}
                  .col-12
                    hr.hr-underline
                  .row.w-100.p-0.m-0
                    .col-12.d-flex.flex-wrap.align-content-center {{ $t("encoder_options") }}
                    .col-12.d-flex.flex-wrap.align-content-center.justify-content-center.mt-3
                      b-form-input(
                        type='text',
                        v-model="cam.videoConfig.encoderOptions"
                      )
                    .col-12.mt-2
                      b-icon.infotext.mr-2(icon="question-circle")
                      span.infotext {{ $t('encoder_options_info') }}
                  .col-12
                    hr.hr-underline
                  b-button#saveButton.w-100.saveButton.mt-2(@click="onSave" :class="(loadingSave ? 'btnError' : 'btn-success')" :disabled="loadingSave" variant="success") 
                    span(v-if="loadingSave") 
                      b-spinner(style="color: #fff" type="grow" small)
                    span(v-else) {{ $t('save') }}
                b-collapse.row(:visible="actives[camera.name] === 'prebuffering'")
                  .col-7.d-flex.flex-wrap.align-content-center {{ $t("status") }}
                  .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                    .d-block.w-100.text-right.mb-2.text-success {{ $t('online') }}
                  .col-12
                    hr.hr-underline
                  .col-7.d-flex.flex-wrap.align-content-center {{ $t("active") }}
                  .col-5.d-flex.flex-wrap.align-content-center.justify-content-end
                    toggle-button(
                      v-model="cam.prebuffering"
                      color="var(--primary-color) !important",
                      :height="30",
                      :sync="true",
                      :aria-expanded="cam.prebuffering ? 'true' : 'false'"
                      aria-controls="prebuffering"
                    )
                  .col-12.mt-2
                    b-icon.infotext.mr-2(icon="question-circle")
                    span.infotext {{ $t('prebuffering_info') }}
</template>

<script>
import { BIcon, BIconQuestionCircle, BIconTriangleFill } from 'bootstrap-vue';
import { ToggleButton } from 'vue-js-toggle-button';

import { /*changeConfig, */ getConfig } from '@/api/config.api';
import { getSetting, changeSetting } from '@/api/settings.api';
import localStorageMixin from '@/mixins/localstorage.mixin';

export default {
  name: 'SettingsCameras',
  components: {
    BIcon,
    BIconQuestionCircle,
    BIconTriangleFill,
    ToggleButton,
  },
  mixins: [localStorageMixin],
  data() {
    return {
      actives: {},
      aws: {},
      awsTimer: null,
      cameras: [],
      camerasTimer: null,
      camerasResolutions: ['256x144', '426x240', '480x360', '640x480', '1280x720', '1920x1080'],
      config: {},
      form: {
        snapshotTimer: 10,
      },
      general: {
        exclude: [],
        rooms: [],
      },
      loading: true,
      loadingSave: false,
      rtspTransport: ['http', 'tcp', 'udp', 'udp_multicast'],
    };
  },
  async created() {
    try {
      if (this.checkLevel('settings:general:access')) {
        const general = await getSetting('general');
        this.general = general.data;
      }

      if (this.checkLevel('settings:cameras:access')) {
        const cameras = await getSetting('cameras');
        this.cameras = cameras.data.map((camera) => {
          camera.rekognition.labels = camera.rekognition.labels.toString();
          this.$set(this.actives, camera.name, 'interface');
          return camera;
        });

        const aws = await getSetting('aws');
        this.aws = aws.data;
      }

      if (this.checkLevel('admin')) {
        const config = await getConfig('?target=config');

        //remove not used params from config editor
        delete config.timestamp;
        delete config.platform;
        delete config.node;
        delete config.version;
        delete config.firstStart;
        delete config.mqttConfigs;
        delete config.serviceMode;

        this.config = {
          port: config.data.port || window.location.port || 80,
          debug: config.data.debug || false,
          language: config.data.language || 'auto',
          theme: config.data.theme || 'auto',
          ssl: config.data.ssl || {
            key: '',
            cert: '',
          },
          http: config.data.http || {
            active: false,
            localhttp: false,
            port: 7575,
          },
          mqtt: config.data.mqtt || {
            active: false,
            host: '',
            port: 1883,
          },
          smtp: config.data.smtp || {
            active: false,
            port: 2525,
            space_replace: '+',
          },
          options: config.data.options || {
            videoProcessor: 'ffmpeg',
          },
          cameras: config.data.cameras || [],
        };
      }

      this.$watch('aws', this.awsWatcher, { deep: true });
      this.$watch('cameras', this.camerasWatcher, { deep: true });
      this.$watch('config', this.configWatcher, { deep: true });

      this.loading = false;
    } catch (err) {
      this.$toast.error(err.message);
    }
  },
  methods: {
    async awsWatcher(newValue) {
      this.$Progress.start();

      if (this.awsTimer) {
        clearTimeout(this.awsTimer);
        this.awsTimer = null;
      }

      this.awsTimer = setTimeout(async () => {
        try {
          await changeSetting('aws', newValue);
          this.$Progress.finish();
        } catch (error) {
          this.$toast.error(error.message);
          this.$Progress.fail();
        }
      }, 2000);
    },
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
    async onSave() {
      const saveButton = document.getElementById('saveButton');
      saveButton.blur();

      if (this.loadingSave) {
        return;
      }

      this.$Progress.start();
      this.loadingSave = true;

      try {
        //await changeConfig(this.config);
        console.log(this.config);
        this.$Progress.finish();
        this.loadingSave = false;
        this.$toast.success(this.$t('config_was_saved'));
      } catch (error) {
        this.$toast.error(error.message);
        this.$Progress.fail();
        this.loadingSave = false;
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

.saveButton {
  height: 40px;
  transition: 0.3s all;
}

.col-12 .infotext {
  font-size: 12px;
  font-weight: 100;
  color: var(--primary-font-color);
  opacity: 0.3;
  font-style: italic;
}

.camera-button {
  font-size: 13px !important;
  background: var(--third-bg-color) !important;
  transition: 0.3s all;
  color: var(--primary-font-color) !important;
  border-radius: 20px !important;
  height: 30px;
}

.camera-button:hover {
  color: #fff !important;
  background: var(--primary-color) !important;
}

.camera-button-active {
  color: #fff !important;
  background: var(--primary-color) !important;
}

@media (max-width: 374px) {
  .camera-button {
    margin-bottom: 5px;
  }

  .camera-button-col {
    max-width: 100% !important;
    flex: 0 0 100%;
    padding: 0;
    margin: 0;
  }
}
</style>
