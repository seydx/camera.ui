import SpinnerIcon from '@openvue/icons/spinner';
import { h } from 'vue';

import type { SetupContext, VNode, VNodeArrayChildren } from 'vue';
import type { CuiButtonProps, CuiButtonSlots } from './types.js';

function CuiButton(props: CuiButtonProps, { attrs, slots }: Pick<SetupContext, 'attrs'> & { slots: CuiButtonSlots }): VNode {
  const hasIcon = slots.icon !== undefined;
  const tag = props.as ?? 'button';
  const isButton = tag === 'button';
  return h(
    tag,
    {
      class: rootClass(props, hasIcon),
      type: isButton ? 'button' : undefined,
      disabled: isButton ? attrs.disabled === '' || !!attrs.disabled || props.loading : undefined,
      'aria-label': props.label || undefined,
    },
    slots.default ? slots.default() : content(props, slots),
  );
}

CuiButton.props = {
  label: String,
  severity: String,
  variant: String,
  size: String,
  text: Boolean,
  outlined: Boolean,
  rounded: Boolean,
  fluid: Boolean,
  loading: Boolean,
  as: String,
};

export default CuiButton;

function rootClass(props: CuiButtonProps, hasIcon: boolean): string {
  let className = 'p-button p-component';
  if (hasIcon && !props.label) className += ' p-button-icon-only';
  if (props.loading) className += ' p-button-loading';
  if (props.severity) className += ` p-button-${props.severity}`;
  if (props.rounded) className += ' p-button-rounded';
  if (props.text || props.variant === 'text') className += ' p-button-text';
  if (props.outlined || props.variant === 'outlined') className += ' p-button-outlined';
  if (props.size === 'small') className += ' p-button-sm';
  else if (props.size === 'large') className += ' p-button-lg';
  if (props.fluid) className += ' p-button-fluid';
  return className;
}

function content(props: CuiButtonProps, slots: CuiButtonSlots): VNodeArrayChildren {
  const icon = props.loading ? spinner(!!props.label) : slots.icon?.();
  return [icon, props.label ? h('span', { class: 'p-button-label' }, props.label) : null];
}

function spinner(hasLabel: boolean): VNode {
  const className = hasLabel ? 'p-button-loading-icon p-button-icon p-button-icon-left' : 'p-button-loading-icon p-button-icon';
  return h(SpinnerIcon, { class: className, spin: true });
}
