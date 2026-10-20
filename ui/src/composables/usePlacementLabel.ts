import { formatCardTime, formatTimestamp } from '@/common/utils.js';

import type { PlacementInfo } from '@shared/types';

export interface PlacementLabelOptions {
  until?: number;
  version?: string;
}

export function usePlacementLabel() {
  const { t } = useI18n();

  function placementLabel(placement: PlacementInfo | undefined, options: PlacementLabelOptions = {}): string | undefined {
    if (!placement) return undefined;
    const worker = placement.worker ?? placement.host;

    switch (placement.phase) {
      case 'local':
        return t('components.placement.local');
      case 'pending':
        return t('components.placement.pending', { worker });
      case 'provisioning':
        return options.version
          ? t('components.placement.provisioning_version', { worker, version: options.version })
          : t('components.placement.provisioning', { worker });
      case 'spawned':
      case 'handshaking':
        return t('components.placement.starting', { worker });
      case 'adopting':
        return t('components.placement.adopting', { worker });
      case 'bound':
        return t('components.placement.bound', { worker });
      case 'restarting':
        return t('components.placement.restarting', { worker });
      case 'held':
        return options.until
          ? t('components.placement.held_until', { worker, time: formatTimestamp(options.until).formattedTime })
          : t('components.placement.held', { worker, time: formatCardTime(placement.since) });
      case 'releasing':
        return t('components.placement.releasing', { worker });
      case 'failed':
        return t('components.placement.failed', { worker });
      case 'waiting-for-worker':
        return t('components.placement.waiting', { worker });
      default:
        return undefined;
    }
  }

  function placementDetail(placement: PlacementInfo | undefined): string | undefined {
    if (!placement || placement.phase === 'local' || placement.phase === 'bound') return undefined;
    return placement.reason;
  }

  function statusWithPlacement(status: string, placement: PlacementInfo | undefined): string {
    if (placement?.phase === 'waiting-for-worker') return placementLabel(placement) ?? status;
    const where = placement && placement.phase !== 'local' ? placementLabel(placement) : undefined;
    return where ? `${status}. ${where}` : status;
  }

  return {
    placementLabel,
    placementDetail,
    statusWithPlacement,
  };
}
