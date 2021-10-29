<template lang="pug">
main.d-flex.flex-wrap.justify-content-center.align-content-center.h-100vh.w-100
  .container
    .start-inner.row
      #main.col.d-flex.flex-wrap.justify-content-center
        .row.w-100.justify-content-center
          h3.mb-0.text-center {{ $t("welcome_message") }} 
            b.text-color-primary camera.ui
        .row.w-100.justify-content-center.my-3
          .col-2.greyline
        .row.w-100.justify-content-center
          p.m-0.lh-1-7.text-center To help you get started and provide good experience with camera.ui, please complete the following configuration.
          b-spinner.text-color-primary.mt-3(v-if="loading")
</template>

<script>
export default {
  name: 'Start',
  data() {
    return {
      loading: true,
    };
  },
  mounted() {
    setTimeout(() => {
      this.loading = false;
    }, 3000);
  },
  methods: {},
};
</script>

<style scoped>
.container {
  max-width: 550px;
  -webkit-box-shadow: 0px 17px 28px -21px rgba(0, 0, 0, 0.68);
  box-shadow: 0px 17px 28px -21px rgba(0, 0, 0, 0.68);
  border-radius: 20px;
  margin: 10px;
}

.start-inner {
  height: 100%;
}

#main {
  padding: 50px;
  background: var(--secondary-bg-color);
  border-radius: 20px;
}

#main p,
#main span {
  color: #c4c4c4;
  font-size: 14px;
}

.redline {
  height: 5px;
  background: var(--primary-color);
}

.greyline {
  height: 5px;
  background: #efefef;
}

@media (max-width: 740px) {
  .start {
    min-width: unset;
    margin: 0 10px;
  }

  #main {
    border-radius: 20px;
  }
  main .container {
    padding-left: 0;
    padding-right: 0;
    width: 80%;
    max-width: 400px;
  }
}

@media (min-width: 768px) {
  .start {
    max-width: 700px;
  }
}

@media (min-width: 992px) {
  .start {
    max-width: 800px;
  }

  #main {
    padding: 50px 70px 50px 70px;
  }
}
</style>
