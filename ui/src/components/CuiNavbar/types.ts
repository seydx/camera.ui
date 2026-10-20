import type { NavLayoutEntry, NavLayoutGroup } from '@/composables/useNavLayout.js';
import type { Component } from 'vue';

export type NavbarState = 'opened' | 'closed';

export const NAVBAR_SIZE = {
  CLOSED: 0,
  MINIFIED: 60,
  EXPANDED: 288,
};

export interface NavbarGroupVm {
  key: NavLayoutGroup;
  items: NavLayoutEntry[];
  collapsible: boolean;
  first: boolean;
}

export interface CuiNavbarGroupProps {
  group: NavbarGroupVm;
  open: boolean;
  active: boolean;
  expanded: boolean;
}

export interface CuiNavbarGroupEmits {
  toggle: [];
  entered: [];
  left: [];
}

export interface CuiNavbarEditItemProps {
  name: string;
  icon?: Component;
  label: string;
  expanded: boolean;
  hideable?: boolean;
  hidden?: boolean;
  findItem: (name: string) => { group: NavLayoutGroup; index: number } | undefined;
  moveItem: (name: string, group: NavLayoutGroup, index: number) => void;
}

export interface CuiNavbarEditItemEmits {
  'toggle-hidden': [];
}

export interface CuiNavbarEditGroupLabelProps {
  group: NavLayoutGroup;
  label: string;
  first: boolean;
  moveToEnd: (name: string, group: NavLayoutGroup) => void;
}
