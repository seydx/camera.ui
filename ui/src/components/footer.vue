<template lang="pug">
v-footer.footer.tw-text-xs.tw-z-0(padless app absolute)
  .footer-wrapper {{ new Date().getFullYear() }} - 
    strong seydx
</template>

<script>
export default {
  name: 'Footer',
};
</script>

<style scoped>
.footer {
  height: 44px;
  background: rgba(var(--cui-bg-app-bar-rgb)) !important;
  color: rgba(var(--cui-text-third-rgb)) !important;
}

.footer-wrapper {
  width: 100%;
  text-align: right;
  padding-right: 1rem;
  max-width: calc(100rem + 64px);
}
</style>
