<template lang="pug">
.tw-flex.tw-align-center.tw-justify-center.tw-z-10
  span {{ updateInformTxt }}
  button.action.refresh-button(@click="$emit('updateClicked')") {{ updateNowTxt }}
</template>

<script>
export default {
  name: 'UpdateBanner',
  props: {
    updateInformTxt: {
      type: String,
      default: 'New update available',
    },
    updateNowTxt: {
      type: String,
      default: 'Refresh',
    },
  },
};
</script>

<style scoped>
.refresh-button {
  border: 1px solid rgb(255 255 255 / 23%);
  border-radius: 5px;
  margin-left: 20px;
  color: #ffffff;
  padding: 5px 10px;
}
</style>
