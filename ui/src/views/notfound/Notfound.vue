<template lang="pug">
  main.d-flex.flex-wrap.justify-content-center.align-content-center.h-100vh.w-100
    .error.container
      .error-inner.row
        .col
          h3.text-center 404  
            br
            b.text-color-primary oops..
            p.mt-3 {{ $t("notfound_message") }}
        .col.d-flex.justify-content-center.mt-2
          b-button.btn-primary(@click="$router.go(-1)") {{ $t("go_back") }}
</template>

<script>
export default {
  name: 'NotFound',
};
</script>

<style scoped>
.error {
  -webkit-box-shadow: 0px 17px 28px -21px rgba(0, 0, 0, 0.68);
  box-shadow: 0px 17px 28px -21px rgba(0, 0, 0, 0.68);
  width: 300px;
}

.error-inner {
  height: 100%;
  padding: 50px;
  background: var(--secondary-bg-color);
  border-radius: 10px;
}

.error-inner p,
.error-inner span {
  color: #c4c4c4;
  font-size: 14px;
}
</style>
