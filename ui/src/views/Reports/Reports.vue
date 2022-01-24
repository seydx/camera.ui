<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-4(v-else)
  .pl-safe.pr-safe

    .header.tw-justify-between.tw-items-center.header.tw-relative.tw-z-10.tw-items-stretch
      .tw-block
        h2 {{ $t($route.name.toLowerCase()) }}

    span.text-muted coming soon...

  LightBox(
    ref="lightboxBanner"
    :media="notImages"
    :showLightBox="false"
    :showThumbs="false"
    showCaption
    disableScroll
  )

</template>

<script>
import LightBox from 'vue-it-bigger';
import 'vue-it-bigger/dist/vue-it-bigger.min.css';

import socket from '@/mixins/socket';

export default {
  name: 'Reports',

  components: {
    LightBox,
  },

  mixins: [socket],

  data() {
    return {
      loading: true,
    };
  },

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  mounted() {
    this.loading = false;
  },
};
</script>

<style scoped></style>
