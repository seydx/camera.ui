import type { CuiButtonAttrs } from '../CuiButton/types.js';

export interface CuiActionButtonProps {
  label?: string;
  icon?: any;
  iconClass?: string;
  buttonProps?: CuiButtonAttrs;
  tooltipProps?: CuiButtonAttrs;
  actionText: string;
  actionDuration?: number;
}

export interface CuiActionButtonEmits {
  (e: 'action', event: Event): void;
}
