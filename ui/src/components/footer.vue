<template lang="pug">
div
  .footer.w-100.flex-wrap.align-content-center(style="display:none; opacity: 0;")
    .footer-inner.container.d-flex.flex-wrap.align-content-center.toggleArea
      .col.p-0.m-0.toggleArea © SeydX
      a(href="https://www.github.com/SeydX/camera.ui", target="_blank" rel="noopener noreferrer")
        b-icon.text-color-primary.fs-6(icon="github", aria-hidden="true")
  .snapline
</template>

<script>
import { BIcon, BIconGithub } from 'bootstrap-vue';

export default {
  name: 'Footer',
  components: {
    BIcon,
    BIconGithub,
  },
  beforeDestroy() {
    document.removeEventListener('scroll', this.scrollHandler);
  },
  mounted() {
    this.snapped = false;
    document.addEventListener('scroll', this.scrollHandler);
  },
  methods: {
    animateOpacity(show, element) {
      let opacity = Number.parseFloat(element.style.opacity || 0);
      const animate = setInterval(() => {
        if (show) {
          if (opacity < 1) {
            opacity += 0.1;
            element.style.display = 'block';
            element.style.opacity = opacity.toString();
          } else {
            clearInterval(animate);
          }
        } else {
          if (opacity > 0) {
            opacity -= 0.1;
            element.style.opacity = opacity.toString();
          } else {
            element.style.display = 'none';
            clearInterval(animate);
          }
        }
      }, 10);
    },
    checkVisibility(elm) {
      const rect = elm.getBoundingClientRect();
      const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
      return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
    },
    scrollHandler() {
      const footer = document.querySelector('.footer');
      const snapline = document.querySelector('.snapline');
      const state = this.checkVisibility(snapline);
      if (state && !this.snapped) {
        this.snapped = true;
        this.animateOpacity(true, footer);
      }
      if (!state && this.snapped) {
        this.snapped = false;
        this.animateOpacity(false, footer);
      }
    },
  },
};
</script>

<style scoped>
.footer {
  width: 100%;
  opacity: 0;
  position: fixed;
  bottom: 0;
  color: var(--primary-font-color);
  font-size: 14px;
  background: var(--secondary-bg-color);
  -webkit-box-shadow: 0px 2px 15px rgba(18, 66, 101, 0.08);
  box-shadow: 0px 2px 15px rgba(18, 66, 101, 0.08);
  border-top: 1px solid var(--third-bg-color);
  transform: translate3d(0, 0, 0);
  -webkit-transform: translate3d(0, 0, 0);
  transition: 0.2s all;
  border-bottom: 5px solid var(--primary-color);
}

.footer-inner {
  height: 55px;
  font-size: 12px;
}

.snapline {
  width: 100%;
  position: relative;
  height: 1px;
  background: transparent;
  bottom: 0;
}

.visible {
  opacity: 1;
}

.hidden {
  opacity: 0;
}
</style>
