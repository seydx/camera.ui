import { EventHoverPreviewKey, useEventHoverPreview } from '@camera.ui/nvr';

export function provideEventHoverPreview(cacheSize: number): void {
  if (typeof VideoDecoder === 'undefined') return;
  const hoverPreview = useEventHoverPreview({ cacheSize });
  provide(EventHoverPreviewKey, hoverPreview);
  tryOnScopeDispose(() => hoverPreview.dispose());
}
