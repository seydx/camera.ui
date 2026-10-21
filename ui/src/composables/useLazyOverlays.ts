export function useLazyOverlays<K extends string>() {
  const mounted = reactive({}) as Partial<Record<K, boolean>>;

  async function toggleOverlay(overlay: K, toggle: () => void): Promise<void> {
    if (!mounted[overlay]) {
      mounted[overlay] = true;
      // the overlay ref exists only after the mount, the click event is still current here
      await nextTick();
    }
    toggle();
  }

  return { mounted, toggleOverlay };
}
