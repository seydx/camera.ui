<template lang="pug">
.loader.tw-flex.tw-justify-center.tw-align-center
  inline-svg(:src="require('../assets/img/logo_loading_circle.svg')" title="camera.ui" aria-label="camera.ui" width="200px")
</template>

<script>
import InlineSvg from 'vue-inline-svg';

export default {
  name: 'Loader',

  components: {
    InlineSvg,
  },

  props: {
    reload: Boolean,
  },

  data: () => ({
    loaderTimeout: null,
  }),

  mounted() {
    if (this.reload) {
      this.loaderTimeout = setInterval(() => {
        const cameraUiLens = document.getElementById('lens');
        cameraUiLens?.classList.remove('cameraLens');

        const cameraUiLetter = document.getElementById('CameraUI_U');
        cameraUiLetter?.classList.remove('cameraLetter');

        setTimeout(() => {
          cameraUiLens?.classList.add('cameraLens');
          cameraUiLetter?.classList.add('cameraLetter');
        }, 100);
      }, 2300);
    }
  },

  beforeDestroy() {
    if (this.loaderTimeout) {
      clearInterval(this.loaderTimeout);
      this.loaderTimeout = null;
    }
  },
};
</script>

<style scoped>
.loader {
  background: rgba(var(--cui-bg-default-rgb));
  width: 100vw;
  min-width: 100vw;
  max-width: 100vw;
  height: 100vh;
  min-height: 100vh;
  max-height: 100vh;
}

div >>> .cameraLens {
  -webkit-animation: lensMove 0.8s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards,
    lensRotate 0.8s ease-in-out 0.4s forwards, lensMoveBack 0.6s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.3s forwards;
  -moz-animation: lensMove 0.8s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards, lensRotate 0.8s ease-in-out 0.4s forwards,
    lensMoveBack 0.6s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.3s forwards;
  -o-animation: lensMove 0.8s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards, lensRotate 0.8s ease-in-out 0.4s forwards,
    lensMoveBack 0.6s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.3s forwards;
  animation: lensMove 0.8s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards, lensRotate 0.8s ease-in-out 0.4s forwards,
    lensMoveBack 0.6s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.3s forwards;
  -webkit-transform-origin: 35% 55%;
  -moz-transform-origin: 35% 55%;
  -o-transform-origin: 35% 55%;
  transform-origin: 35% 55%;
}

div >>> .cameraLetter {
  -moz-animation: letterScale 0.4s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards,
    letterScaleBack 0.4s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.2s forwards;
  -o-animation: letterScale 0.4s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards,
    letterScaleBack 0.4s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.2s forwards;
  -webkit-animation: letterScale 0.4s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards,
    letterScaleBack 0.4s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.2s forwards;
  animation: letterScale 0.4s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards,
    letterScaleBack 0.4s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.2s forwards;
  -webkit-transform-origin: center;
  -moz-transform-origin: center;
  -o-transform-origin: center;
  transform-origin: center;
}

@keyframes letterScale {
  0% {
    -webkit-transform: scale(1);
    -moz-transform: scale(1);
    -o-transform: scale(1);
    transform: scale(1);
  }
  100% {
    -webkit-transform: scale(0.8);
    -moz-transform: scale(0.8);
    -o-transform: scale(0.8);
    transform: scale(0.8);
  }
}

@keyframes letterScaleBack {
  0% {
    -webkit-transform: scale(0.8);
    -moz-transform: scale(0.8);
    -o-transform: scale(0.8);
    transform: scale(0.8);
  }
  100% {
    -webkit-transform: scale(1);
    -moz-transform: scale(1);
    -o-transform: scale(1);
    transform: scale(1);
  }
}

@keyframes lensMove {
  0% {
    -webkit-transform: translateY(0px);
    -moz-transform: translateY(0px);
    -o-transform: translateY(0px);
    transform: translateY(0px);
  }
  100% {
    -webkit-transform: translateY(-40px);
    -moz-transform: translateY(-40px);
    -o-transform: translateY(-40px);
    transform: translateY(-40px);
  }
}

@keyframes lensMoveBack {
  0% {
    -webkit-transform: translateY(-40px);
    -moz-transform: translateY(-40px);
    -o-transform: translateY(-40px);
    transform: translateY(-40px);
  }
  100% {
    -webkit-transform: translateY(0px);
    -moz-transform: translateY(0px);
    -o-transform: translateY(0px);
    transform: translateY(0px);
  }
}

@keyframes lensRotate {
  0% {
    -webkit-transform: translateY(-40px) rotate(0deg);
    -moz-transform: translateY(-40px) rotate(0deg);
    -o-transform: translateY(-40px) rotate(0deg);
    transform: translateY(-40px) rotate(0deg);
  }
  100% {
    -webkit-transform: translateY(-40px) rotate(-360deg);
    -moz-transform: translateY(-40px) rotate(-360deg);
    -o-transform: translateY(-40px) rotate(-360deg);
    transform: translateY(-40px) rotate(-360deg);
  }
}
</style>
