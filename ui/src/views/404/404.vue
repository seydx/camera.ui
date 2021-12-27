<template lang="pug">
.tw-w-full.tw-flex.tw-flex-col.tw-justify-center.tw-items-center(style="min-height: 100vh")
  .tw-flex.tw-items-center.tw-justify-center
    span.error-title 4
    v-img.tw-mx-2.logo(src="@/assets/img/logo.svg" width="40px")
    span.error-title 4
  .subtitle oops..
  span.text-muted {{ $t('page_not_found') }}
  v-btn.tw-mt-5(text color="var(--cui-primary)" @click="$router.go(-1)") {{ $t('back') }}
              
</template>

<script>
export default {
  name: 'NotFound',
};
</script>

<style scoped>
.error-title {
  font-size: 4rem;
  font-weight: 700;
}

.subtitle {
  color: rgba(var(--cui-text-default-rgb)) !important;
  font-size: 2rem;
  font-weight: 600;
}
</style>
