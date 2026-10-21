import type { ButtonHTMLAttributes, Slot } from 'vue';

export interface CuiButtonProps {
  label?: string;
  severity?: string;
  variant?: 'text' | 'outlined';
  size?: 'small' | 'large';
  text?: boolean;
  outlined?: boolean;
  rounded?: boolean;
  fluid?: boolean;
  loading?: boolean;
  as?: string;
}

export interface CuiButtonAttrs extends CuiButtonProps, ButtonHTMLAttributes {
  // vue's recursive ClassValue and StyleValue overflow DeepMaybeRef in useCuiDialog
  class?: any;
  style?: any;
}

export interface CuiButtonSlots {
  default?: Slot;
  icon?: Slot;
}
