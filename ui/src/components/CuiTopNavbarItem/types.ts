import type { BadgeProps } from 'openvue';

export type TopNavbarItemType = 'button' | 'tab' | 'dropdown';

export type TopNavbarItemStatus = 'connected' | 'connecting' | 'disconnected';

export interface CuiTopNavbarItemProps {
  active?: boolean;
  closeable?: boolean;
  menuOpen?: boolean;
  primary?: boolean;
  type?: TopNavbarItemType;
  status?: TopNavbarItemStatus;
  label?: string;
  disabled?: boolean;
  badge?: string;
  badgeSeverity?: BadgeProps['severity'];
  loading?: boolean;
}

export interface CuiTopNavbarItemEmits {
  (e: 'click', event: MouseEvent): void;
  (e: 'close'): void;
}
