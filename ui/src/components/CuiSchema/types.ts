import type { PluginConfig, SchemaConfig } from '@camera.ui/sdk';
import type { CuiButtonProps } from '../CuiButton/types.js';

export interface CuiSchemaProps {
  schemaForm: SchemaConfig;
  loading?: boolean;
  disableButton?: boolean;
  saveButton?: boolean;
  saveButtonLabel?: string;
  saveButtonColor?: CuiButtonProps['severity'];
  showButton?: boolean;
  groupsAsCards?: boolean;
  groupDescriptions?: Record<string, string>;
}

export interface CuiSchemaEmits {
  (e: 'onSubmit', state: { key: string; payload: any }): void;
  (e: 'onAction', state: { key: string }): void;
  (e: 'onFormSubmit', state: PluginConfig): void;
  (e: 'changeGroup', state: string): void;
}
