<template lang="pug">
.notification(@click="$emit('showNotification')")
  span.before
  span.after
  header
    h2 {{ headerTxt }}
    span.timestamp {{ timeTxt }}
  .content
    span.title {{ title }}
    span.message {{ message }}
    span.subtxt {{ subtxt }}
    span.detailBar
</template>

<script>
export default {
  name: 'NotificationBanner',
  props: {
    headerTxt: {
      type: String,
      default: 'Notifications',
    },
    timeTxt: {
      type: String,
      default: 'Now',
    },
    title: {
      type: String,
      default: 'Motion',
    },
    message: {
      type: String,
      default: 'Motion',
    },
    subtxt: {
      type: String,
      default: 'Motion',
    },
  },
};
</script>

<style>
.Vue-Toastification__container.top-center {
  margin-top: calc(env(safe-area-inset-top, -10px) + 10px) !important;
  border-radius: 16px !important;
}

.Vue-Toastification__toast--info.notification-toast {
  background-color: rgba(var(--cui-bg-banner-rgb), 0.8) !important;
  backdrop-filter: blur(5px) !important;
  -webkit-backdrop-filter: blur(5px) !important;
  color: var(--cui-text-default) !important;
  border-radius: 16px !important;
  padding: 14px !important;
}

.notification,
.notification:hover {
  position: relative;
  overflow: hidden;
  color: var(--cui-text-default) !important;
  text-decoration: none !important;
  cursor: pointer;
}

.notification header,
.notification .subtxt {
  opacity: 0.75;
}
.notification header {
  display: flex;
  justify-content: space-between;
  padding-bottom: 3px;
  font-size: 12px;
}
.notification header h2 {
  text-transform: uppercase;
  font-size: 10px;
  color: var(--cui-text-hint);
}
.notification header .timestamp {
  text-transform: lowercase;
  font-size: 10px;
}
.notification .content span {
  display: block;
  line-height: 1.4;
}
.notification .content .detailBar {
  background: rgb(94 94 94 / 10%);
  border-radius: 5px;
  height: 5px;
  margin-top: 5px;
  margin-bottom: -5px;
  width: 50%;
  margin-left: auto;
  margin-right: auto;
}
.notification .content .message {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}
.notification .content .title,
.notification .content .event {
  font-weight: 600;
}
.notification .content .subtxt {
  margin-top: 4px;
  font-size: 10px;
  color: var(--cui-text-hint);
}
.notification .before,
.notification .after {
  left: calc(50% - 50vw);
}
</style>
