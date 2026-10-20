<template>
  <div v-if="group.collapsible" class="w-full h-[50px]" :class="{ 'mt-5': !group.first }" :data-nav-group="group.key">
    <Button
      text
      severity="secondary"
      class="cui-button navitem-button w-full h-full flex items-center justify-center dark-mode"
      :class="{
        '!text-white navitem-active': open || active,
        'hover:!text-color active:!text-color focus:!text-color navitem-inactive': !open && !active,
      }"
      :style="{
        color: '#a4a4a4',
      }"
      @click="$emit('toggle')"
    >
      <template #default>
        <div class="flex items-center h-full absolute left-[14px] gap-3">
          <i-mdi:chevron-down v-if="open" class="w-[22px] h-[22px]" />
          <i-mdi:chevron-up v-else class="w-[22px] h-[22px]" />
          <span v-if="expanded" class="text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap">{{ $t(`navigation.group_${group.key}`) }}</span>
        </div>
      </template>
    </Button>
  </div>
  <div v-else-if="group.key !== 'main'" class="w-full flex items-center h-[26px] mb-1" :class="{ 'mt-5': !group.first }">
    <span v-if="expanded" class="pl-[17px] text-[11px] font-semibold uppercase tracking-widest text-[#7a7a7a] whitespace-nowrap">{{
      $t(`navigation.group_${group.key}`)
    }}</span>
    <div v-else class="w-[22px] mx-auto border-t border-[#313131]"></div>
  </div>

  <Transition name="navbar-group" @after-enter="$emit('entered')" @after-leave="$emit('left')">
    <div v-if="!group.collapsible || open" class="flex flex-col space-y-1 overflow-hidden" :data-nav-group="group.key">
      <div v-for="item in group.items" :key="item.name" class="w-full h-[50px] relative">
        <CuiNavItem
          :icon="item.icon"
          :active-icon="item.activeIcon"
          :to="item.to"
          :label="$t(`navigation.${item.labelKey}`)"
          :expanded
          dark-mode
          show-tooltip
          :icon-size="22"
          :button-props="{
            style: {
              color: '#a4a4a4',
            },
          }"
          class="w-[50px] h-[50px]"
          :class="{
            'w-full': expanded,
          }"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { CuiNavbarGroupEmits, CuiNavbarGroupProps } from './types.js';

defineProps<CuiNavbarGroupProps>();

defineEmits<CuiNavbarGroupEmits>();
</script>

<style scoped>
.navbar-group-enter-active,
.navbar-group-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.navbar-group-enter-from,
.navbar-group-leave-to {
  max-height: 0;
  opacity: 0;
}

.navbar-group-enter-to,
.navbar-group-leave-from {
  max-height: 400px;
  opacity: 1;
}
</style>
