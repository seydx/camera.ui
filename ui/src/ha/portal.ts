import Popover from 'openvue/popover';
import Portal from 'openvue/portal';
import { createBlock, createCommentVNode, openBlock, renderSlot, Teleport } from 'vue';

import { setTooltipContainer } from '@/plugins/tooltip.js';

export function redirectOverlays(host: Element): void {
  redirectPortals(host);
  setTooltipContainer(host);
  acceptShadowClicks();
}

function redirectPortals(host: Element): void {
  (Portal as { render?: unknown }).render = (
    ctx: { $slots: Record<string, unknown> },
    _cache: unknown,
    props: { appendTo: string | Element },
    _setup: unknown,
    data: { mounted: boolean },
    options: { inline: boolean },
  ) => {
    if (options.inline) return renderSlot(ctx.$slots as never, 'default', { key: 0 });
    if (!data.mounted) return createCommentVNode('', true);
    return (
      openBlock(),
      createBlock(Teleport, { key: 1, to: props.appendTo === 'body' ? host : props.appendTo }, [renderSlot(ctx.$slots as never, 'default')], 8, ['to'])
    );
  };
}

function acceptShadowClicks(): void {
  const methods = (Popover as unknown as { methods: { isTargetClicked(event: Event): boolean } }).methods;
  methods.isTargetClicked = function (this: { eventTarget?: Element | null }, event: Event): boolean {
    const target = this.eventTarget;
    if (!target) return false;
    return target === event.target || target.contains(event.target as Node) || event.composedPath().includes(target);
  };
}
