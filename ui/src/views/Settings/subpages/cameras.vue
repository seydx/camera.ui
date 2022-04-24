<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)" style="z-index: 3;")

  .tw-mb-7.tw-mt-5(v-if="!loading" ref="innerContainer")
    label.form-input-label {{ $t('selected_camera') }}
    v-select(v-model="camera" :items="cameras" :no-data-text="$t('no_data_available')" item-text="name" prepend-inner-icon="mdi-cctv" append-outer-icon="mdi-close-thick" background-color="var(--cui-bg-card)" return-object solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiCctv'] }}
      template(v-slot:append-outer)
        v-dialog(v-model="removeCameraDialog" width="500" scrollable)
          template(v-slot:activator='{ on, attrs }')
            v-btn(icon v-bind='attrs' v-on='camera && camera.name ? on : null' style="margin-top: -6px;")
              v-icon.tw-cursor-pointer(color="error") {{ icons['mdiCloseThick'] }}
          v-card(v-if="camera && camera.name")
            v-card-title {{ $t('remove_camera') }}
            v-divider
            v-card-text.tw-p-7.text-default.tw-text-center {{ moduleName === 'homebridge-camera-ui' ? $t('remove_camera_confirm_text_homebridge').replace('@', camera.name) : $t('remove_camera_confirm_text').replace('@', camera.name) }}
            v-divider
            v-card-actions.tw-flex.tw-justify-end
              v-btn.text-default(text @click='removeCameraDialog = false') {{ $t('cancel') }}
              v-btn(color='var(--cui-primary)' text @click='onRemoveCamera') {{ $t('remove') }}

    AddCamera(@add="cameraAdded" :cameras="cameras")

    v-divider.tw-my-8

    div(v-if="cameras.length")
      .tw-mt-8(v-for="cam in config.cameras" :key="cam.name")
        div(v-if="camera && camera.name === cam.name")

          v-btn.save-btn(:class="fabAbove ? 'save-btn-top' : ''" v-scroll="onScroll" v-show="fab" color="success" transition="fade-transition" width="40" height="40" fab dark fixed bottom right @click="onSave" :loading="loadingProgress")
            v-icon {{ icons['mdiCheckBold'] }}

          v-sheet.tw-p-3.tw-mb-5.mx-auto.tw-text-sm(rounded width="100%" color="rgba(var(--cui-text-default-rgb), 0.1)")
            span.text-default {{ $t('camera_settings_save_info') }}

          v-expansion-panels(v-model="panel[cam.name]")
            v-expansion-panel
              v-expansion-panel-header
                div
                  .page-subtitle {{ $t('interface') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_interface_info') }}
              v-expansion-panel-content
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
                    label.form-input-label {{ $t('record_on_movement') }} ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('record_on_movement_info') }}
                        br(v-if="moduleName === 'homebridge-camera-ui' || env === 'development'")
                        span(style="color: #FF5252 !important" v-if="moduleName === 'homebridge-camera-ui' || env === 'development'") Attention: Enabling this option will disable HSV and disabling this option will enable HSV.
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

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('interface_player') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_player_info') }}
              v-expansion-panel-content
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

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('notification') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_notification_info') }}
              v-expansion-panel-content
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

                label.form-input-label {{ $t('mqtt_publish_topic') }}
                v-text-field(v-model="camera.mqttTopic" prepend-inner-icon="mdi-link" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiLink'] }}

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('rekognition') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_rekognition_info') }}
              v-expansion-panel-content
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

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('alarm') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_alarm_info') }}
              v-expansion-panel-content
                h4.tw-my-3 {{ $t('http') }}

                label.form-input-label {{ $t('motion') }}
                v-text-field(:value="`http://${hostname}:${config.http.port || 7272}/motion?${encodeURIComponent(camera.name)}`" persistent-hint :hint="$t('alarm_http_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo disabled)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label {{ $t('motion_reset') }}
                v-text-field(:value="`http://${hostname}:${config.http.port || 7272}/reset?${encodeURIComponent(camera.name)}`" persistent-hint :hint="$t('alarm_http_reset_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo disabled)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                h4.tw-my-3 {{ $t('ftp') }}

                label.form-input-label {{ $t('ftp_absolute_path') }}
                v-text-field(:value="camera.name" persistent-hint :hint="$t('alarm_ftp_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo disabled)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                h4.tw-my-3 {{ $t('email') }}

                label.form-input-label {{ $t('email_to') }} ¹
                v-text-field(v-model="cam.smtp.email" persistent-hint :hint="$t('email_to_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label {{ $t('email_from') }} ¹
                v-text-field(v-model="cam.smtp.from" persistent-hint :hint="$t('email_from_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label {{ $t('email_body_lookup') }} ¹
                v-text-field(v-model="cam.smtp.body" persistent-hint :hint="$t('email_body_lookup_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                h4.tw-my-3 {{ $t('mqtt') }}

                label.form-input-label Motion Topic ¹
                v-text-field(v-model="cam.mqtt.motionTopic" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Motion Message ¹
                v-text-field(v-model="cam.mqtt.motionMessage" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Motion Reset Topic ¹
                v-text-field(v-model="cam.mqtt.motionResetTopic" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Motion Reset Message ¹
                v-text-field(v-model="cam.mqtt.motionResetMessage" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Doorbell Topic ¹
                v-text-field(v-model="cam.mqtt.doorbellTopic" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Doorbell Message ¹
                v-text-field(v-model="cam.mqtt.doorbellMessage" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                v-divider.tw-mt-1.tw-mb-7

                v-btn.tw-text-white(:loading="prebufferingStates[cam.name].motionLoading" block color="success" @click="triggerMotion(true)") Trigger Motion
                v-btn.tw-text-white.tw-mt-3(:loading="prebufferingStates[cam.name].motionLoading" block color="error" @click="triggerMotion(false)") Reset Motion

            v-expansion-panel(v-if="moduleName === 'homebridge-camera-ui' || env === 'development'")
              v-expansion-panel-header
                div
                  .page-subtitle Homebridge
                  .page-header-info.tw-mt-1 {{ $t('camera_homebridge_info') }}
              v-expansion-panel-content
                v-sheet.tw-p-3.tw-mb-5.mx-auto.tw-text-sm(rounded width="100%" color="rgba(var(--cui-text-default-rgb), 0.1)")
                  span.text-default {{ $t('homebridge_restart_info') }}

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Disable ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('disable_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.disable")

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Privacy Mode
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('privacyMode_info') }}
                        br
                        span(style="color: #FF5252 !important") Attention: "At Home" must be enabled for privacy mode to work
                  v-switch(color="var(--cui-primary)" v-model="camera.privacyMode")
                
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Unbridge (Recommended) ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('unbridge_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.unbridge")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Motion Sensor ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('motionSensor_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.motion")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Doorbell Sensor ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('doorbellSensor_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.doorbell")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Motion / Doorbell Switches ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('motionDoorbellSwitch_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.switches")

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Privacy Switch ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('privacySwitch_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.privacySwitch")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Trigger Doorbell on Motion ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('motionDoorbell_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.motionDoorbell")

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Exclude Switch ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('excludeSwitch_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.excludeSwitch")

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Interface Recording Timer ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('use_interface_timer_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.useInterfaceTimer")
                
                label.form-input-label Manufacturer ¹ ²
                v-text-field(v-model="cam.manufacturer" :hint="$t('manufacturer_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}
                      
                label.form-input-label Model ¹ ²
                v-text-field(v-model="cam.model" :hint="$t('model_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}
                      
                label.form-input-label Serial Number ¹ ²
                v-text-field(v-model="cam.serialNumber" :hint="$t('serialNumber_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('prebuffering') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_prebuffering_info') }}
              v-expansion-panel-content
                .tw-flex.tw-justify-between.tw-items-center
                  label.form-input-label {{ $t('status') }}
                  span.tw-text-right(:class="!prebufferingStates[cam.name].state ? 'tw-text-red-500' : 'tw-text-green-500'") {{ prebufferingStates[cam.name].state ? $t('active') : $t('inactive') }}

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label {{ $t('enabled') }} ¹
                  v-switch(color="var(--cui-primary)" v-model="cam.prebuffering")

                v-btn.tw-text-white.tw-mt-3(:disabled="!prebufferingStates[cam.name].state" :loading="prebufferingStates[cam.name].loading" block color="error" @click="onHandlePrebuffering(cam.name, false)") {{ $t('stop') }}
                v-btn.tw-text-white.tw-mt-5(:disabled="!cam.prebuffering" :loading="prebufferingStates[cam.name].loading" block color="success" @click="onHandlePrebuffering(cam.name, true)") {{ $t('restart') }}

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('videoanalysis') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_videoanalysis_info') }}
              v-expansion-panel-content
                .tw-w-full.tw-mt-3.tw-mb-8.tw-relative(v-resize="adjustPlayground" style="background: #000; border-radius: 10px;")
                  .tw-w-full.tw-h-full.tw-flex.tw-justify-center.tw-items-center(v-if="options[cam.name].loading")
                    v-progress-circular(indeterminate color="var(--cui-primary)" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);")
                    v-img.tw-w-full(src="#" :width="playgroundWidth" :height="playgroundHeight")

                  .tw-w-full(v-else)
                    playground(
                      :width="playgroundWidth",
                      :height="playgroundHeight",
                      :options="options[cam.name]"
                      :regions="camera.videoanalysis.regions",
                      :customizing="customizing"
                      @addHandle="addHandle"
                      @updateHandle="updateHandle"
                    )

                .tw-w-full.tw-flex.tw-justify-center.tw-items-center.tw-my-8
                  v-btn(@click="customizing ? finishCustom() : startCustom()") {{ customizing ? $t('finish_zone') : $t('new_zone') }}
                  v-btn.tw-mx-2(@click="undo") {{ $t('undo') }}
                  v-btn(@click="clear") {{ $t('clear') }}

                label.form-input-label {{ $t('dwell_time') }}
                v-slider(:messages="$t('dwell_time_info')" min="15" max="180" step="1" thumb-label v-model="camera.videoanalysis.dwellTimer")
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                .tw-my-3

                label.form-input-label {{ $t('forceClose_timer') }}
                v-slider(:messages="$t('forceClose_timer_info')" min="0" max="10" step="1" thumb-label v-model="camera.videoanalysis.forceCloseTimer")
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                .tw-my-3

                label.form-input-label {{ $t('sensitivity') }}
                v-slider(:messages="$t('sensitivity_info')" min="0" max="100" step="1" thumb-label v-model="camera.videoanalysis.sensitivity")
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}
                
                .tw-my-3
                
                label.form-input-label {{ $t('pixel_difference') }}
                v-slider(:messages="$t('pixel_difference_info')" min="1" max="255" step="1" thumb-label v-model="camera.videoanalysis.difference")
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}
                      
                v-btn.tw-text-white.tw-mt-8(block color="var(--cui-primary)" @click="resetVideoanalysis") {{ $t('reset') }}

                v-divider.tw-mt-10
                
                .tw-flex.tw-justify-between.tw-items-center.tw-mt-10
                  label.form-input-label {{ $t('status') }}
                  span.tw-text-right(:class="!videoanalysisStates[cam.name].state ? 'tw-text-red-500' : 'tw-text-green-500'") {{ videoanalysisStates[cam.name].state ? $t('active') : $t('inactive') }}

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label {{ $t('enabled') }} ¹
                  v-switch(color="var(--cui-primary)" v-model="cam.videoanalysis.active")

                v-btn.tw-text-white.tw-mt-3(:disabled="!videoanalysisStates[cam.name].state" :loading="videoanalysisStates[cam.name].loading" block color="error" @click="onHandleVideoanalysis(cam.name, false)") {{ $t('stop') }}
                v-btn.tw-text-white.tw-mt-5(:disabled="!cam.videoanalysis" :loading="videoanalysisStates[cam.name].loading" block color="success" @click="onHandleVideoanalysis(cam.name, true)") {{ $t('restart') }}

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('ffmpeg_and_stream') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_ffmpeg_stream_info') }}
              v-expansion-panel-content
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Debug ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('debug_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.debug")

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Audio ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('audio_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.audio")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Read Rate ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('read_rate_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.readRate")

                label.form-input-label Video Source ¹
                v-text-field(v-model="cam.videoConfig.source" :hint="$t('source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Subtream Source ¹
                v-text-field(v-model="cam.videoConfig.subSource" :hint="$t('sub_source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Still Image Source ¹
                v-text-field(v-model="cam.videoConfig.stillImageSource" :hint="$t('still_image_source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Motion Timeout ¹
                v-text-field(v-model.number="cam.motionTimeout" :hint="$t('motion_timeout_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Max Streams ¹
                v-text-field(v-model.number="cam.videoConfig.maxStreams" :hint="$t('max_streams_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Width ¹
                v-text-field(v-model.number="cam.videoConfig.maxWidth" :hint="$t('width_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Height ¹
                v-text-field(v-model.number="cam.videoConfig.maxHeight" :hint="$t('height_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label FPS ¹
                v-text-field(v-model.number="cam.videoConfig.maxFPS" :hint="$t('fps_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Bitrate ¹
                v-text-field(v-model.number="cam.videoConfig.maxBitrate" :hint="$t('bitrate_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label RTSP Transport ¹
                v-text-field(v-model="cam.videoConfig.rtspTransport" :hint="$t('rtsp_transport_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Codec ¹
                v-text-field(v-model="cam.videoConfig.vcodec" :hint="$t('video_codec_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Audio Codec ¹
                v-text-field(v-model="cam.videoConfig.acodec" :hint="$t('audio_codec_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Stream Timeout ¹
                v-text-field(v-model.number="cam.videoConfig.stimeout" :hint="$t('timeout_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Analyze Duration ¹
                v-text-field(v-model.number="cam.videoConfig.analyzeDuration" :hint="$t('analyze_duration_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Probe Size ¹
                v-text-field(v-model.number="cam.videoConfig.probeSize" :hint="$t('probe_size_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Reorder Queue Size ¹
                v-text-field(v-model.number="cam.videoConfig.reorderQueueSize" :hint="$t('reorder_queue_size_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Max Timeout ¹
                v-text-field(v-model.number="cam.videoConfig.maxTimeout" :hint="$t('max_delay_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Filter ¹
                v-text-field(v-model="cam.videoConfig.vfilter" :hint="$t('video_filter_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Stream Map ¹
                v-text-field(v-model="cam.videoConfig.mapvideo" :hint="$t('map_video_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Audio Stream Map ¹
                v-text-field(v-model="cam.videoConfig.mapaudio" :hint="$t('map_audio_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Encoder Options ¹
                v-text-field(v-model="cam.videoConfig.encoderOptions" :hint="$t('encoder_options_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}   
                
                .tw-mt-3(v-if="moduleName === 'homebridge-camera-ui' || env === 'development'")
                  .page-subtitle HKSV Configuration

                  .tw-flex.tw-justify-between.tw-items-center
                    .tw-block.tw-w-full.tw-pr-2
                      label.form-input-label Audio ¹
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ $t('audio_info_hksv') }}
                    v-switch(color="var(--cui-primary)" :input-value="cam.hksvConfig ? cam.hksvConfig.audio : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'audio', $event)")

                  label.form-input-label Video Source ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.source : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'source', $event)" :hint="$t('source_info_hksv')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Video Width ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.maxWidth : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'maxWidth', $event)" :hint="$t('width_info_hksv')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiNumeric'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Video Height ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.maxHeight : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'maxHeight', $event)" :hint="$t('height_info_hksv')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiNumeric'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label FPS ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.maxFPS : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'maxFPS', $event)" :hint="$t('fps_info_hksv')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiNumeric'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Bitrate ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.maxBitrate : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'maxBitrate', $event)" :hint="$t('bitrate_info_hksv')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiNumeric'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Video Codec ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.vcodec : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'vcodec', $event)" :hint="$t('video_codec_info_hksv')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Audio Codec ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.acodec : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'acodec', $event)" :hint="$t('audio_codec_info_hksv')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Encoder Options ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.encoderOptions : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'encoderOptions', $event)" :hint="$t('encoder_options_info_hksv')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
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
  mdiCheckBold,
  mdiCloseThick,
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
import {
  getCameraSnapshot,
  removeCamera,
  restartPrebuffering,
  restartVideoanalysis,
  startMotion,
  stopPrebuffering,
  stopVideoanalysis,
  resetMotion,
} from '@/api/cameras.api';
import { changeConfig, getConfig } from '@/api/config.api';
import { getSetting, changeSetting } from '@/api/settings.api';

import AddCamera from '@/components/add-camera.vue';
import playground from '@/components/playground.vue';

import { bus } from '@/main';

export default {
  name: 'CamerasSettings',

  components: {
    AddCamera,
    playground: playground,
  },

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data() {
    return {
      env: '',
      panel: {},

      fab: true,
      fabAbove: false,

      removeCameraDialog: false,

      icons: {
        mdiAlert,
        mdiAlphabetical,
        mdiCctv,
        mdiCheckBold,
        mdiCloseThick,
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
      loadingRestartPrebuffering: false,

      camera: {},
      config: {},
      cameras: [],
      camerasTimeout: null,
      configTimeout: null,

      configChanged: false,

      options: {},

      customizing: false,
      playgroundWidth: 0,
      playgroundHeight: 0,

      general: {
        exclude: [],
        rooms: [],
      },

      moduleName: 'camera.ui',
      hostname: window.location.hostname,

      search: null,
      labels: ['Human', 'Face', 'Person', 'Body'],
      resolutions: ['256x144', '426x240', '480x360', '640x480', '1280x720', '1920x1080'],

      telegramTypes: [
        { value: 'Text', text: this.$t('text') },
        { value: 'Snapshot', text: this.$t('snapshot') },
        { value: 'Text + Snapshot', text: `${this.$t('text')} + ${this.$t('snapshot')}` },
        { value: 'Video', text: this.$t('video') },
        { value: 'Text + Video', text: `${this.$t('text')} + ${this.$t('video')}` },
        { value: 'Disabled', text: this.$t('disabled') },
      ],

      prebufferingStates: {},
      videoanalysisStates: {},
    };
  },

  watch: {
    panel: {
      async handler() {
        let panel = [];

        if (this.panel[this.camera.name]) {
          if (!Array.isArray(this.panel[this.camera.name])) {
            panel.push(this.panel[this.camera.name]);
          } else {
            panel = this.panel[this.camera.name].map((i) => i);
          }
        }

        const panelId = this.moduleName === 'homebridge-camera-ui' || this.env === 'development' ? 7 : 6;
        const isVideoAnalysisPanelOpen = panel.some((index) => index === panelId);

        if (isVideoAnalysisPanelOpen && !this.options[this.camera.name]?.background) {
          this.adjustPlayground();

          try {
            const snapshot = await getCameraSnapshot(this.camera.name, '?buffer=true&fromSubSource=true');
            this.options[this.camera.name].background = `data:image/png;base64,${snapshot.data}`;
            this.options[this.camera.name].loading = false;
          } catch (err) {
            console.log(err);
            this.$toast.error(err.message);
          }
        }
      },
      deep: true,
    },
  },

  async created() {
    try {
      this.env = process.env.NODE_ENV;

      const general = await getSetting('general');
      this.general = general.data;

      await this.configCameraSettings();
      await this.configCameras();

      this.camera = this.cameras?.length ? this.cameras[0] : [];

      this.$socket.client.on('prebufferStatus', this.prebufferStatus);
      this.$socket.client.emit(
        'getCameraPrebufferSatus',
        this.cameras.map((camera) => camera.name)
      );

      this.$socket.client.on('videoanalysisStatus', this.videoanalysisStatus);
      this.$socket.client.emit(
        'getCameraVideoanalysisSatus',
        this.cameras.map((camera) => camera.name)
      );

      this.$watch('cameras', this.camerasWatcher, { deep: true });
      this.$watch('camera', this.cameraWatcher, { deep: true });
      this.$watch('config', this.configWatcher, { deep: true });

      this.loading = false;
      this.loadingProgress = false;

      window.addEventListener('resize', this.adjustPlayground);
      window.addEventListener('orientationchange', this.adjustPlayground);

      this.adjustPlayground();
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    this.$socket.client.off('prebufferStatus', this.prebufferStatus);
    this.$socket.client.off('videoanalysisStatus', this.videoanalysisStatus);

    window.removeEventListener('resize', this.adjustPlayground);
    window.removeEventListener('orientationchange', this.adjustPlayground);
  },

  methods: {
    addToObject(config, objectName, key, value) {
      if (!config[objectName]) {
        config[objectName] = {};
      }

      config[objectName][key] = value;
    },
    async cameraAdded(camera) {
      try {
        await this.configCameraSettings();
        await this.configCameras();

        const cameraIndex = this.cameras.findIndex((cam) => cam.name === camera.name);
        this.camera = this.cameras[cameraIndex] || {};
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    async configCameras() {
      const config = await getConfig('?target=config');

      this.moduleName = config.data.env.moduleName;

      this.config = {
        port: config.data.port || window.location.port || 80,
        logLevel: config.data.logLevel || 'info',
        ssl: config.data.ssl || {
          key: '',
          cert: '',
        },
        http: config.data.http || {
          active: false,
          localhttp: false,
          port: 7272,
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
        ftp: config.data.ftp || {
          active: false,
          port: 5050,
        },
        options: config.data.options || {
          videoProcessor: 'ffmpeg',
        },
        cameras: (config.data.cameras || []).map((camera) => {
          camera.mqtt = camera.mqtt || {};
          camera.videoanalysis = camera.videoanalysis || {};
          camera.smtp = camera.smtp || {};

          this.$set(this.panel, camera.name, []);

          this.$set(this.prebufferingStates, camera.name, {
            state: false,
            loading: false,
            motionLoading: false,
          });

          this.$set(this.videoanalysisStates, camera.name, {
            state: false,
            loading: false,
          });

          this.$set(this.options, camera.name, {
            loading: true,
            background: '',
          });

          return camera;
        }),
      };
    },
    async configCameraSettings() {
      const cameras = await getSetting('cameras');
      this.cameras = cameras.data;
    },
    async onSave() {
      this.loadingProgress = true;

      try {
        await changeConfig(this.config);
        this.$toast.success(this.$t('config_was_saved'));
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.configChanged = false;
      this.loadingProgress = false;
    },
    async cameraWatcher() {
      this.cameras = this.cameras.map((camera) => {
        if (camera.name === this.camera.name) {
          camera = this.camera;
        }
        return camera;
      });
    },
    async camerasWatcher() {
      this.loadingProgress = true;

      if (this.camerasTimeout) {
        clearTimeout(this.camerasTimeout);
        this.camerasTimeout = null;
      }

      this.camerasTimeout = setTimeout(async () => {
        try {
          await changeSetting('cameras', this.cameras, '?stopStream=true');
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }

        this.loadingProgress = false;
      }, 2000);
    },
    async configWatcher() {
      this.configChanged = true;
    },
    async onHandlePrebuffering(cameraName, restart) {
      if (this.prebufferingStates[cameraName].loading) {
        return;
      }

      this.prebufferingStates[cameraName].loading = true;

      try {
        if (restart) {
          await restartPrebuffering(cameraName);
        } else {
          await stopPrebuffering(cameraName);
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.prebufferingStates[cameraName].loading = false;
    },
    async onHandleVideoanalysis(cameraName, restart) {
      if (this.videoanalysisStates[cameraName].loading) {
        return;
      }

      this.videoanalysisStates[cameraName].loading = true;

      try {
        if (restart) {
          await restartVideoanalysis(cameraName);
        } else {
          await stopVideoanalysis(cameraName);
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.videoanalysisStates[cameraName].loading = false;
    },
    async onRemoveCamera() {
      if (!this.camera) {
        return this.$toast.error(this.$t('no_camera_selected'));
      }

      const cameraName = this.camera.name;
      const cameraIndex = this.cameras.findIndex((camera) => camera.name === cameraName);

      try {
        await removeCamera(cameraName);
        this.removeCameraDialog = false;

        setTimeout(() => {
          //this.cameras = this.cameras.filter((camera) => camera.name !== cameraName);

          this.$delete(this.cameras, cameraIndex);
          this.camera = this.cameras[0] || {};

          delete this.panel[cameraName];
          delete this.prebufferingStates[cameraName];
          delete this.videoanalysisStates[cameraName];
          delete this.options[cameraName];
        }, 500);

        this.$toast.success(`${this.$t('successfully_removed')}`);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);

        this.removeCameraDialog = false;
      }
    },
    onScroll(e) {
      if (typeof window === 'undefined') {
        this.fabAbove = true;
        return;
      }

      const top = window.pageYOffset || e.target.scrollTop || 0;
      this.fabAbove = top > 20;
    },
    prebufferStatus(data) {
      if (this.prebufferingStates[data.camera]) {
        this.prebufferingStates[data.camera].state = data.status === 'active';
      }
    },
    resetVideoanalysis() {
      if (this.camera) {
        const DEFAULT_FORCECLOSE_TIME = 3;
        const DEFAULT_DWELL_TIME = 60;
        const DEFAULT_DIFFERENCE = 5; // 1 - 255
        const DEFAULT_SENSITIVITY = 75; // 0 - 100

        this.camera.videoanalysis = {
          ...this.camera.videoanalysis,
          sensitivity: DEFAULT_SENSITIVITY,
          difference: DEFAULT_DIFFERENCE,
          dwellTimer: DEFAULT_DWELL_TIME,
          forceCloseTimer: DEFAULT_FORCECLOSE_TIME,
        };
      }
    },
    async triggerMotion(state) {
      if (!this.camera) {
        return this.$toast.error(this.$t('no_camera_selected'));
      }

      if (this.prebufferingStates[this.camera.name].motionLoading) {
        return;
      }

      this.prebufferingStates[this.camera.name].motionLoading = true;

      try {
        if (state) {
          await startMotion(this.camera.name);
        } else {
          await resetMotion(this.camera.name);
        }
        this.$toast.success(this.$t('successfull'));
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.prebufferingStates[this.camera.name].motionLoading = false;
    },
    videoanalysisStatus(data) {
      if (this.videoanalysisStates[data.camera]) {
        this.videoanalysisStates[data.camera].state = data.status === 'active';
      }
    },
    addHandle(e) {
      let x = Math.round(((e.offsetX - 10) / this.playgroundWidth) * 100);
      let y = Math.round(((e.offsetY - 10) / this.playgroundHeight) * 100);

      const regionIndex = this.camera.videoanalysis.regions?.length
        ? this.camera.videoanalysis.regions[this.camera.videoanalysis.regions.length - 1].finished
          ? this.camera.videoanalysis.regions.length
          : this.camera.videoanalysis.regions.length - 1
        : 0;

      if (!this.camera.videoanalysis.regions[regionIndex]) {
        this.camera.videoanalysis.regions.push({
          finished: false,
          coords: [],
        });
      }

      this.camera.videoanalysis.regions[regionIndex].coords.push([x, y]);

      bus.$emit('handleAdded', {
        cIndex: this.camera.videoanalysis.regions[regionIndex].coords.length - 1,
        rIndex: regionIndex,
        coord: [x, y],
      });
    },
    updateHandle(payload) {
      let x = Math.round((payload.x / this.playgroundWidth) * 100);
      let y = Math.round((payload.y / this.playgroundHeight) * 100);

      this.$set(this.camera.videoanalysis.regions[payload.regionIndex].coords, payload.coordIndex, [x, y]);
    },
    undo() {
      if (!this.camera.videoanalysis.regions?.length) {
        return;
      }

      const rIndex = this.camera.videoanalysis.regions.length - 1;
      this.camera.videoanalysis.regions[rIndex]?.coords?.pop();

      if (!this.camera.videoanalysis.regions[rIndex].coords?.length) {
        this.camera.videoanalysis.regions = this.camera.videoanalysis.regions.filter((region, i) => i !== rIndex);
      } else if (!this.customizing && this.camera.videoanalysis.regions[rIndex].coords?.length < 3) {
        this.camera.videoanalysis.regions = this.camera.videoanalysis.regions.filter((region, i) => i !== rIndex);
      }
    },
    clear() {
      this.camera.videoanalysis.regions = [];
      bus.$emit('clearDraggs');
    },
    startCustom() {
      this.customizing = true;
    },
    finishCustom() {
      this.customizing = false;

      if (!this.camera.videoanalysis.regions?.length) {
        return;
      }

      const rIndex = this.camera.videoanalysis.regions.length - 1;

      if (this.camera.videoanalysis.regions[this.camera.videoanalysis.regions.length - 1].coords.length < 3) {
        this.camera.videoanalysis.regions = this.camera.videoanalysis.regions.filter((region, i) => i !== rIndex);
      } else {
        this.camera.videoanalysis.regions[rIndex].finished = true;
        bus.$emit('customizingFinished');
      }
    },
    adjustPlayground() {
      if (this.$refs.innerContainer && this.camera.name) {
        const width = this.$refs.innerContainer.offsetWidth;
        const height = (width - 20) / (16 / 9);

        this.playgroundWidth = width - 20;
        this.playgroundHeight = height;
      }
    },
  },
};
</script>

<style scoped>
.save-btn {
  right: 30px !important;
  bottom: 45px !important;
  z-index: 11 !important;
  transition: 0.3s all;
}

.save-btn-top {
  bottom: 95px !important;
}

div >>> .v-chip .v-chip__content {
  color: #fff !important;
}

div >>> .v-expansion-panels .v-expansion-panel {
  background: none;
  color: var(--cui-text-default);
  border-bottom: 1px solid rgba(var(--cui-text-default-rgb), 0.12);
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

div >>> .v-expansion-panel-header {
  padding-left: 0;
  padding-right: 0;
}

div >>> .v-expansion-panel-content__wrap {
  padding-left: 0;
  padding-right: 0;
}

div >>> .v-expansion-panel::before {
  box-shadow: unset;
}

div >>> .theme--light.v-expansion-panels .v-expansion-panel-header .v-expansion-panel-header__icon .v-icon {
  color: rgba(var(--cui-text-default-rgb), 0.4);
}

div >>> .v-expansion-panel:not(:first-child)::after {
  border: none;
}

/*div >>> .v-expansion-panels > *:last-child {
  border: none !important;
}*/

div >>> .v-slider__thumb-label {
  color: #fff !important;
}

div >>> .v-slider__track-background.primary.lighten-3 {
  background-color: #5a5a5a !important;
  border-color: #5a5a5a !important;
}
</style>

<style scoped lang="scss">
main {
  display: flex;
  flex-direction: column;

  @media (min-width: 800px) {
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    right: 23.625rem;
    padding: 0.25rem 0.25rem 0.25rem 0.75rem;
    touch-action: none;

    .panel.dark {
      display: none;
    }
  }

  header {
    justify-content: space-between;
    background: rgba(251, 252, 247, 0.75);
    box-shadow: inset 0 -1px rgba(211, 208, 201, 0.25);
    padding: 0.75rem 1rem;

    @media (min-width: 800px) {
      font-size: larger;
      padding: 0.75rem 1rem;
      border-radius: 2px 2px 0 0;
    }

    h1 {
      padding: 0.25rem;
      font-size: 1rem;
      font-weight: 400;
    }
  }
}
</style>
