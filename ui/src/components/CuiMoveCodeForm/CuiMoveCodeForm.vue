<template>
  <form class="flex flex-col gap-4 w-full" @submit.prevent="fetch">
    <Message v-if="offersCode" severity="secondary" variant="simple" size="small">{{ $t('restore.move_code_offered') }}</Message>

    <div class="flex flex-col field-gap">
      <label for="moveCode" class="cui-label">{{ $t('restore.move_code') }}</label>
      <InputText id="moveCode" v-model="code" class="font-mono" :disabled="disabled" spellcheck="false" autocomplete="off" />
      <Message severity="secondary" variant="simple" size="small" class="cui-input-hint">{{ $t('restore.move_code_hint') }}</Message>
    </div>

    <div class="flex flex-col field-gap">
      <label for="moveAddress" class="cui-label">{{ $t('restore.move_address') }}</label>
      <InputText id="moveAddress" v-model="address" placeholder="192.168.1.10:3443" :disabled="disabled" autocomplete="off" />
      <Message severity="secondary" variant="simple" size="small" class="cui-input-hint">{{ $t('restore.move_address_hint') }}</Message>
    </div>

    <Button type="submit" class="ml-auto cui-button-medium" :disabled="!code.trim() || disabled" :label="$t('restore.move_fetch')" />
  </form>
</template>

<script setup lang="ts">
import type { CuiMoveCodeFormProps } from './types.js';

const props = defineProps<CuiMoveCodeFormProps>();

const { fetchFromServer } = useBackupRestore();

const code = ref('');
const address = ref('');

const disabled = computed(() => isRestoreActive.value || props.offersCode);

function fetch(): void {
  if (!code.value.trim() || disabled.value) return;
  fetchFromServer(code.value.trim(), address.value.trim() || undefined);
}
</script>
