import type { RouteLocationAsPathGeneric, RouteLocationAsRelativeGeneric } from 'vue-router';
import type { CuiButtonAttrs } from '../CuiButton/types.js';

export interface CuiListItemProps {
  active?: boolean;
  disabled?: boolean;
  to?: string | RouteLocationAsRelativeGeneric | RouteLocationAsPathGeneric;
  activeClass?: string;
  buttonProps?: CuiButtonAttrs;
  tooltip?: string;
  size?: 'default' | 'large';
  divider?: boolean;
  radius?: 'top' | 'bottom' | 'both' | 'none';
}

export interface CuiListItemEmits {
  (e: 'click', event: MouseEvent): void;
}
