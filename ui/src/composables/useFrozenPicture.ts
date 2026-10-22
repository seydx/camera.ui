import { FindObjectKey } from '@/components/CuiFindObjectView/types.js';
import { cropImage } from '@/utils/imageCrop.js';
import { maskPrivacyZones } from '@/utils/privacyMask.js';

import type { FindObjectState } from '@/components/CuiFindObjectView/types.js';
import type { SimilarPickPoint } from '@/components/CuiSimilarPicker/types.js';
import type { FrameObject, SimilarQuery } from '@camera.ui/nvr';
import type { PrivacyZone } from '@camera.ui/sdk';
import type { DBCamera } from '@shared/types';

export interface FrozenStillPosition {
  from: 'live' | 'playback';
  atMs: number;
}

export interface UseFrozenPictureOptions {
  camera: () => DBCamera | undefined;
  box: () => HTMLElement | null | undefined;
  capture: () => Promise<Blob | string | null | undefined> | Blob | string | null | undefined;
  position: () => FrozenStillPosition;
  privacyZones: () => PrivacyZone[];
  pause: () => void;
  resume: () => void;
  settled: () => boolean;
  find?: FindObjectState;
}

const FOLLOW_SETTLE_MS = 250;
const FOLLOW_TIMEOUT_MS = 10_000;

export function useFrozenPicture(options: UseFrozenPictureOptions) {
  const find = options.find ?? inject(FindObjectKey, undefined);
  const toast = useCuiToast();
  const { t } = useI18n();

  const frozen = ref(false);
  const still = shallowRef<Blob>();
  const point = shallowRef<SimilarPickPoint>();
  let stillAt: FrozenStillPosition = { from: 'live', atMs: 0 };
  let takes = 0;
  let untrack: (() => void) | undefined;
  let followTimer: ReturnType<typeof setTimeout> | undefined;

  function freezeAt(clientX: number, clientY: number): void {
    const rect = options.box()?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    freeze({ x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height });
  }

  function freeze(at?: SimilarPickPoint): void {
    if (frozen.value) return;
    frozen.value = true;
    point.value = at;
    stillAt = options.position();
    untrack = find?.track({ release });
    options.pause();
    take();
  }

  async function take(): Promise<void> {
    const id = ++takes;
    const at = options.position();
    const picture = await readFrame().catch(() => null);
    if (!frozen.value || id !== takes) return;
    if (picture) {
      stillAt = at;
      still.value = picture;
    } else if (!still.value) {
      toast.add({ severity: 'error', detail: t('components.similar.failed'), life: 4000 });
      release(true);
    }
  }

  // the old still stays until the player shows its new position
  function follow(): void {
    if (!frozen.value) return;
    clearTimeout(followTimer);
    const id = ++takes;
    followTimer = setTimeout(async () => {
      await until(options.settled).toBe(true, { timeout: FOLLOW_TIMEOUT_MS });
      if (id === takes && frozen.value) await take();
    }, FOLLOW_SETTLE_MS);
  }

  function release(resume: boolean): void {
    if (!frozen.value) return;
    takes++;
    clearTimeout(followTimer);
    frozen.value = false;
    still.value = undefined;
    point.value = undefined;
    untrack?.();
    untrack = undefined;
    if (resume) options.resume();
  }

  function stillPosition(): FrozenStillPosition {
    return stillAt;
  }

  async function readFrame(): Promise<Blob | null> {
    const source = await options.capture();
    return source ? maskPrivacyZones(source, options.privacyZones()) : null;
  }

  async function pick(object: FrameObject & { query: SimilarQuery }): Promise<void> {
    const camera = options.camera();
    if (!camera || !find) return;
    const crop = still.value ? await cropImage(still.value, object.box, object.mask) : undefined;
    find.add(camera, { query: object.query, objectLabel: object.label, crop });
  }

  onScopeDispose(() => {
    takes++;
    clearTimeout(followTimer);
    untrack?.();
  });

  return { frozen, still, point, freezeAt, follow, release, stillPosition, pick };
}
