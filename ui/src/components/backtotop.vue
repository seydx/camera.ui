<template lang="pug">
v-fab-transition
  v-btn.backtotop-btn(v-scroll="onScroll" v-show="fab" transition="fade-transition" width="40" height="40" fab dark fixed bottom right @click="toTop")
    v-icon mdi-chevron-up
</template>

<script>
export default {
  name: 'BackToTop',

  data: () => ({
    fab: false,
  }),

  methods: {
    onScroll(e) {
      if (typeof window === 'undefined') {
        return;
      }

      const top = window.pageYOffset || e.target.scrollTop || 0;
      this.fab = top > 20;
    },
    toTop() {
      this.$vuetify.goTo(0);
    },
  },
};
</script>

<style scoped>
.backtotop-btn {
  background: rgba(var(--cui-primary-rgb)) !important;
  right: 30px !important;
  bottom: 45px !important;
  z-index: 11 !important;
}
</style>
