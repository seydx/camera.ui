import { asyncComponent } from '@/common/asyncComponent.js';

import type { BackupRestoreProps } from '@/components/CuiDialog/templates/BackupRestore/types.js';
import type { DynamicDialogInstance } from 'openvue/dynamicdialogoptions';

const BackupRestoreDialog = asyncComponent(() => import('@/components/CuiDialog/templates/BackupRestore/BackupRestore.vue'));

export function useBackupRestoreDialog(layoutShown: () => boolean): void {
  const dialog = useCuiDialog();
  const { t } = useI18n();
  const { phase, resume } = useBackupRestore();

  let instance: DynamicDialogInstance | undefined;

  function open(): void {
    if (instance || phase.value === 'idle' || !layoutShown()) return;

    instance = dialog.openComponentDialog<BackupRestoreProps>(BackupRestoreDialog, {
      data: {
        title: t('restore.title'),
        closable: false,
        blurMask: true,
        dialogContentClass: 'grow',
        contentProps: {},
      },
      dialogSize: { desktop: { width: '520px', maxWidth: '90vw', maxHeight: '90vh' } },
      onSettled: () => (instance = undefined),
    });
  }

  onMounted(() => {
    watch(
      layoutShown,
      (shown) => {
        if (shown) resume();
        else instance = undefined;
      },
      { immediate: true },
    );

    watch(
      [phase, layoutShown],
      () => {
        if (phase.value === 'idle') instance?.close();
        else nextTick(open);
      },
      { immediate: true, flush: 'post' },
    );
  });
}
