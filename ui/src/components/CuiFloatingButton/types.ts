import type { ButtonProps, TooltipOptions } from 'openvue';

export interface CuiFloatingButtonProps {
  buttonProps?: ButtonProps;
  tooltipProps?: TooltipOptions;
  label?: string;
  icon?: any;
  iconProps?: Record<string, any>;
  grouped?: boolean;
  forceVisible?: boolean;
}

export interface CuiFloatingButtonEmits {
  (e: 'click'): void;
  (e: 'expand'): void;
  (e: 'shrink'): void;
  (e: 'hover', hovered: boolean): void;
}
