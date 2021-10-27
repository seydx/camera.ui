<template lang="pug">
.back-to-top.mr-save.mb-save.text-center(@click="backToTop()")
  b-icon(icon="arrow-up-short", aria-hidden="true", style="vertical-align: -.2em !important")
</template>

<script>
import { BIcon, BIconArrowUpShort } from 'bootstrap-vue';

export default {
  name: 'BackToTop',
  components: {
    BIcon,
    BIconArrowUpShort,
  },
  beforeDestroy() {
    document.removeEventListener('scroll', this.scrollHandler);
  },
  mounted() {
    document.addEventListener('scroll', this.scrollHandler);
  },
  methods: {
    backToTop() {
      const y = window.scrollY;
      let dif = y - 10 < 0 ? 0 : y - 10;
      if (y > 0) {
        setTimeout(() => {
          window.scrollTo(0, dif);
          this.backToTop();
        }, 5);
      }
    },
    scrollHandler() {
      const backToTopButton = document.querySelector('.back-to-top');
      if (window.scrollY > 50) {
        backToTopButton.classList.add('isVisible');
        backToTopButton.classList.remove('isHidden');
      } else {
        backToTopButton.classList.add('isHidden');
        backToTopButton.classList.remove('isVisible');
      }
    },
  },
};
</script>

<style scoped>
.back-to-top {
  position: fixed;
  display: block;
  opacity: 0;
  right: 25px;
  bottom: 40px;
  z-index: 98;
  width: 30px;
  height: 30px;
  background: var(--primary-color);
  border-radius: 15px;
  color: #ffffff !important;
  border: 2px solid rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.isVisible {
  opacity: 0.8;
  transition: all 0.4s ease-in;
}

.isVisible:hover {
  opacity: 1;
}

.isHidden {
  opacity: 0;
  transition: all 0.4s ease-in;
}
</style>
