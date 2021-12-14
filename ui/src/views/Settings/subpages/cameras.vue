<template lang="pug">
.tw-w-full.tw-mt-8
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-7(v-if="!loading")
    label.form-input-label {{ $t('selected_camera') }}
    v-select(v-model="camera" :items="cameras" item-text="name" prepend-inner-icon="mdi-cctv" background-color="var(--cui-bg-card)" return-object solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiCctv'] }}

    v-divider.tw-mt-4.tw-mb-8

    .tw-mt-8(v-for="cam in config.cameras" v-if="camera.name && camera.name === cam.name")
      .page-subtitle-info {{ $t('interface') }}

      .tw-flex.tw-justify-between.tw-items-center
        .tw-block.tw-w-full.tw-pr-2
          label.form-input-label {{ `${$t('dashboard')} ${$t('livestream')}` }}
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ $t('livestream_snapshot') }}
        v-switch(color="var(--cui-primary)" v-model="camera.dashboard.live")
        
      .tw-flex.tw-justify-between.tw-items-center
        .tw-block.tw-w-full.tw-pr-2
          label.form-input-label {{ `${$t('camview')} ${$t('livestream')}` }}
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ $t('livestream_snapshot') }}
        v-switch(color="var(--cui-primary)" v-model="camera.camview.live")

      .tw-flex.tw-justify-between.tw-items-center.tw-mb-3
        .tw-block.tw-w-full.tw-pr-2
          label.form-input-label {{ $t('record_on_movement') }}
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ $t('record_on_movement_info') }}
        v-switch(color="var(--cui-primary)" v-model="cam.recordOnMovement")
        
      label.form-input-label {{ `${$t('dashboard')} ${$t('snapshot_timer')}` }}
      v-text-field(v-model.number="camera.dashboard.snapshotTimer" type="number" :suffix="$t('seconds')" prepend-inner-icon="mdi-speedometer" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiSpeedometer'] }}

      label.form-input-label {{ `${$t('camview')} ${$t('snapshot_timer')}` }}
      v-text-field(v-model.number="camera.camview.snapshotTimer" type="number" :suffix="$t('seconds')" prepend-inner-icon="mdi-speedometer" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiSpeedometer'] }}

      label.form-input-label {{ $t('room') }}
      v-select.select(prepend-inner-icon="mdi-door" v-model="camera.room" :items="general.rooms" background-color="var(--cui-bg-card)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiDoor'] }}

      v-divider.tw-mt-4.tw-mb-8

      .page-subtitle-info {{ $t('interface_player') }}

      .tw-flex.tw-justify-between.tw-items-center
        label.form-input-label {{ $t('audio') }}
        v-switch(color="var(--cui-primary)" v-model="camera.audio")
      
      label.form-input-label {{ $t('video_resolution') }}
      v-select.select(prepend-inner-icon="mdi-video-high-definition" v-model="camera.resolution" :items="resolutions" background-color="var(--cui-bg-card)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiVideoHighDefinition'] }}
       
      label.form-input-label {{ $t('ping_timeout') }}
      v-text-field(v-model.number="camera.pingTimeout" type="number" :suffix="$t('seconds')" prepend-inner-icon="mdi-speedometer" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiSpeedometer'] }}

      label.form-input-label {{ $t('stream_timeout') }}
      v-text-field(v-model.number="camera.streamTimeout" type="number" :suffix="$t('seconds')" prepend-inner-icon="mdi-speedometer" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiSpeedometer'] }}

      v-divider.tw-mt-4.tw-mb-8
      
      .page-subtitle-info {{ $t('notification') }}
      
      .tw-flex.tw-justify-between.tw-items-center
        label.form-input-label {{ $t('alexa') }}
        v-switch(color="var(--cui-primary)" v-model="camera.alexa")
      
      label.form-input-label {{ $t('telegram_message_type') }}
      v-select.select(prepend-inner-icon="mdi-video-image" v-model="camera.telegramType" :items="telegramTypes" background-color="var(--cui-bg-card)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiVideoImage'] }}

      label.form-input-label {{ $t('webhook_url') }}
      v-text-field(v-model="camera.webhookUrl" prepend-inner-icon="mdi-link" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiLink'] }}

      v-divider.tw-mt-4.tw-mb-8
      
      .page-subtitle-info {{ $t('rekognition') }}

      .tw-flex.tw-justify-between.tw-items-center
        label.form-input-label {{ $t('amazon_rekognition') }}
        v-switch(color="var(--cui-primary)" v-model="camera.rekognition.active")

      label.form-input-label {{ $t('confidence') }}
      v-text-field(v-model.number="camera.rekognition.confidence" type="number" suffix="%" prepend-inner-icon="mdi-percent" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiPercent'] }}

      label.form-input-label {{ $t('labels') }}
      v-combobox(v-model="camera.rekognition.labels" :items="labels" :search-input.sync="search" prepend-inner-icon="mdi-label" hide-selected :label="$t('add_labels')" multiple small-chips solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiLabel'] }}
        template(v-slot:no-data v-if="search")
          v-list-item
            v-list-item-content
              v-list-item-title 
                span {{ $t('no_label_matching') }} 
                strong "{{ search }}"
                span . {{ $t('press_enter_to_create').split(' %')[0] }} 
                kbd {{ $t('press_enter_to_create').split(' %')[1].split('% ')[0] }}
                span  {{ $t('press_enter_to_create').split('% ')[1] }} 
      
      v-divider.tw-mt-4.tw-mb-8
      
      div(v-if="moduleName === 'camera.ui'")
        .page-subtitle-info Homebridge
        .input-info Changing some of the Homebridge plugin parameters requires a restart of camera.ui for the changes to take effect
          
        .tw-flex.tw-justify-between.tw-items-center.tw-mt-5
          .tw-block.tw-w-full.tw-pr-2
            label.form-input-label Privacy Mode
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ $t('privacyMode_info') }}
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal(v-if="!general.atHome")
              v-btn.input-info(text to="/settings/interface" color="error" style="padding: 0; height: 17px;")
                v-icon.text-muted.tw-mr-1(small color="error") {{ icons['mdiAlert'] }} 
                span Attention: "At Home" must be enabled for privacy mode to work
          v-switch(color="var(--cui-primary)" v-model="camera.privacyMode")
        
        .tw-flex.tw-justify-between.tw-items-center
          .tw-block.tw-w-full.tw-pr-2
            label.form-input-label Unbridge (Recommended)
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ $t('unbridge_info') }}
          v-switch(color="var(--cui-primary)" v-model="cam.unbridge")
          
        .tw-flex.tw-justify-between.tw-items-center
          .tw-block.tw-w-full.tw-pr-2
            label.form-input-label Motion Sensor
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ $t('motionSensor_info') }}
          v-switch(color="var(--cui-primary)" v-model="cam.motion")
          
        .tw-flex.tw-justify-between.tw-items-center
          .tw-block.tw-w-full.tw-pr-2
            label.form-input-label Doorbell Sensor
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ $t('doorbellSensor_info') }}
          v-switch(color="var(--cui-primary)" v-model="cam.doorbell")
          
        .tw-flex.tw-justify-between.tw-items-center
          .tw-block.tw-w-full.tw-pr-2
            label.form-input-label Motion / Doorbell Switches
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ $t('motionDoorbellSwitch_info') }}
          v-switch(color="var(--cui-primary)" v-model="cam.switches")

        .tw-flex.tw-justify-between.tw-items-center
          .tw-block.tw-w-full.tw-pr-2
            label.form-input-label Privacy Switch
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ $t('privacySwitch_info') }}
          v-switch(color="var(--cui-primary)" v-model="cam.privacySwitch")
          
        .tw-flex.tw-justify-between.tw-items-center
          .tw-block.tw-w-full.tw-pr-2
            label.form-input-label Trigger Doorbell on Motion
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ $t('motionDoorbell_info') }}
          v-switch(color="var(--cui-primary)" v-model="cam.motionDoorbell")

        .tw-flex.tw-justify-between.tw-items-center
          .tw-block.tw-w-full.tw-pr-2
            label.form-input-label Exclude Switch
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ $t('excludeSwitch_info') }}
          v-switch(color="var(--cui-primary)" v-model="cam.excludeSwitch")
        
        label.form-input-label Manufacturer
        v-text-field(v-model="cam.manufacturer" :hint="$t('manufacturer_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
          template(v-slot:prepend-inner)
            v-icon.text-muted {{ icons['mdiAlphabetical'] }}
          template(v-slot:message="{ key, message}")
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ message }}
              
        label.form-input-label Model
        v-text-field(v-model="cam.model" :hint="$t('model_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
          template(v-slot:prepend-inner)
            v-icon.text-muted {{ icons['mdiAlphabetical'] }}
          template(v-slot:message="{ key, message}")
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ message }}
              
        label.form-input-label Serial Number
        v-text-field(v-model="cam.serialNumber" :hint="$t('serialNumber_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
          template(v-slot:prepend-inner)
            v-icon.text-muted {{ icons['mdiAlphabetical'] }}
          template(v-slot:message="{ key, message}")
            .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
              v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
              .input-info.tw-italic {{ message }}
      
        v-divider.tw-mt-4.tw-mb-8
      
      .page-subtitle-info {{ $t('ffmpeg_and_stream') }}

      .tw-flex.tw-justify-between.tw-items-center
        .tw-block.tw-w-full.tw-pr-2
          label.form-input-label Debug
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ $t('debug_info') }}
        v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.debug")

      .tw-flex.tw-justify-between.tw-items-center
        .tw-block.tw-w-full.tw-pr-2
          label.form-input-label Prebuffering
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ $t('prebuffering_info') }}
        v-switch(color="var(--cui-primary)" v-model="cam.prebuffering")

      .tw-flex.tw-justify-between.tw-items-center
        .tw-block.tw-w-full.tw-pr-2
          label.form-input-label Audio
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ $t('audio_info') }}
        v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.audio")
        
      .tw-flex.tw-justify-between.tw-items-center
        .tw-block.tw-w-full.tw-pr-2
          label.form-input-label Read Rate
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ $t('read_rate_info') }}
        v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.readRate")

      label.form-input-label Video Source
      v-text-field(v-model="cam.videoConfig.source" :hint="$t('source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
            v-icon.text-muted {{ icons['mdiAlphabetical'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Still Image Source
      v-text-field(v-model="cam.videoConfig.stillImageSource" :hint="$t('still_image_source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
            v-icon.text-muted {{ icons['mdiAlphabetical'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Motion Timeout
      v-text-field(v-model.number="cam.videoConfig.motionTimeout" :hint="$t('motion_timeout_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Max Streams
      v-text-field(v-model.number="cam.videoConfig.maxStreams" :hint="$t('max_streams_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Video Width
      v-text-field(v-model.number="cam.videoConfig.maxWidth" :hint="$t('width_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Video Height
      v-text-field(v-model.number="cam.videoConfig.maxHeight" :hint="$t('height_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label FPS
      v-text-field(v-model.number="cam.videoConfig.maxFPS" :hint="$t('fps_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Bitrate
      v-text-field(v-model.number="cam.videoConfig.maxBitrate" :hint="$t('bitrate_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label RTSP Transport
      v-text-field(v-model="cam.videoConfig.rtspTransport" :hint="$t('rtsp_transport_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiAlphabetical'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Video Codec
      v-text-field(v-model="cam.videoConfig.vcodec" :hint="$t('video_codec_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiAlphabetical'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Audio Codec
      v-text-field(v-model="cam.videoConfig.acodec" :hint="$t('audio_codec_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiAlphabetical'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Stream Timeout
      v-text-field(v-model.number="cam.videoConfig.stimeout" :hint="$t('timeout_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Analyze Duration
      v-text-field(v-model.number="cam.videoConfig.analyzeDuration" :hint="$t('analyze_duration_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Probe Size
      v-text-field(v-model.number="cam.videoConfig.probeSize" :hint="$t('probe_size_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Reorder Queue Size
      v-text-field(v-model.number="cam.videoConfig.reorderQueueSize" :hint="$t('reorder_queue_size_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Max Timeout
      v-text-field(v-model.number="cam.videoConfig.maxTimeout" :hint="$t('max_delay_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiNumeric'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Video Filter
      v-text-field(v-model="cam.videoConfig.vfilter" :hint="$t('video_filter_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiAlphabetical'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Video Stream Map
      v-text-field(v-model="cam.videoConfig.vmap" :hint="$t('map_video_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiAlphabetical'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Audio Stream Map
      v-text-field(v-model="cam.videoConfig.amap" :hint="$t('map_audio_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiAlphabetical'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}

      label.form-input-label Encodec Options
      v-text-field(v-model="cam.videoConfig.encoderOptions" :hint="$t('encoder_options_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiAlphabetical'] }}
        template(v-slot:message="{ key, message}")
          .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
            v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
            .input-info.tw-italic {{ message }}   

</template>

<script>
import {
  mdiAlert,
  mdiAlphabetical,
  mdiCctv,
  mdiDoor,
  mdiInformationOutline,
  mdiLabel,
  mdiLink,
  mdiNumeric,
  mdiPercent,
  mdiSpeedometer,
  mdiVideoHighDefinition,
  mdiVideoImage,
} from '@mdi/js';

import { changeConfig, getConfig } from '@/api/config.api';
import { getSetting, changeSetting } from '@/api/settings.api';

export default {
  name: 'CamerasSettings',

  data() {
    return {
      icons: {
        mdiAlert,
        mdiAlphabetical,
        mdiCctv,
        mdiDoor,
        mdiInformationOutline,
        mdiLabel,
        mdiLink,
        mdiNumeric,
        mdiPercent,
        mdiSpeedometer,
        mdiVideoHighDefinition,
        mdiVideoImage,
      },

      loading: true,
      loadingProgress: true,

      camera: {},
      config: {},
      cameras: [],
      camerasTimeout: null,
      configTimeout: null,

      general: {
        exclude: [],
        rooms: [],
      },

      moduleName: 'camera.ui',

      search: null,
      labels: ['Human', 'Face', 'Person', 'Body'],
      resolutions: ['256x144', '426x240', '480x360', '640x480', '1280x720', '1920x1080'],

      telegramTypes: [
        { value: 'Text', text: this.$t('text') },
        { value: 'Snapshot', text: this.$t('snapshot') },
        { value: 'Video', text: this.$t('video') },
        { value: 'Disabled', text: this.$t('disabled') },
      ],
    };
  },

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  async created() {
    try {
      const general = await getSetting('general');
      this.general = general.data;

      const cameras = await getSetting('cameras');
      this.cameras = cameras.data;

      const config = await getConfig('?target=config');

      this.moduleName = config.data.env.moduleName;

      //remove not used params from config editor
      delete config.timestamp;
      delete config.platform;
      delete config.node;
      delete config.version;
      delete config.firstStart;
      delete config.mqttConfigs;
      delete config.serviceMode;
      delete config.env;

      this.config = {
        port: config.data.port || window.location.port || 80,
        debug: config.data.debug || false,
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

      this.$watch('cameras', this.camerasWatcher, { deep: true });
      this.$watch('config', this.configWatcher, { deep: true });

      this.camera = this.cameras[0];

      this.loading = false;
      this.loadingProgress = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  methods: {
    async camerasWatcher(newValue) {
      this.loadingProgress = true;

      if (this.camerasTimeout) {
        clearTimeout(this.camerasTimeout);
        this.camerasTimeout = null;
      }

      this.camerasTimeout = setTimeout(async () => {
        try {
          await changeSetting('cameras', newValue, '?stopStream=true');
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }

        this.loadingProgress = false;
      }, 2000);
    },
    async configWatcher() {
      this.loadingProgress = true;

      if (this.configTimeout) {
        clearTimeout(this.configTimeout);
        this.configTimeout = null;
      }

      this.configTimeout = setTimeout(async () => {
        try {
          await changeConfig(this.config);
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }

        this.loadingProgress = false;
      }, 2000);
    },
  },
};
</script>

<style scoped>
div >>> .v-chip .v-chip__content {
  color: #fff !important;
}
</style>
