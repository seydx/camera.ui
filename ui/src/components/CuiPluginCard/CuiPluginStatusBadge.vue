<template>
  <Badge
    v-tooltip.top="{ value: statusTooltip }"
    :style="{
      background: pluginsSocket.statusColor.value,
    }"
  ></Badge>
</template>

<script setup lang="ts">
const props = defineProps<{ pluginName: string }>();

const { t } = useI18n();
const { statusWithPlacement } = usePlacementLabel();

const pluginsSocket = usePluginsSocket(props.pluginName);

const statusTooltip = computed(() => statusWithPlacement(t(`components.plugin_card.status_${pluginsSocket.status.value}`), pluginsSocket.placement.value));

onBeforeMount(() => {
  pluginsSocket.connect();
});
</script>

<style scoped></style>
