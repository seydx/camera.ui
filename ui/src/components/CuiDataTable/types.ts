import { TABLE_PAGE_LINK_SIZE, TABLE_PAGINATOR_TEMPLATE } from '@/common/constants.js';

export interface CuiDataTableProps {
  value?: unknown[] | null;
  rows?: number;
  paginator?: boolean;
  paginatorTemplate?: string;
  pageLinkSize?: number;
}

export const CUI_DATA_TABLE_DEFAULTS = {
  paginatorTemplate: TABLE_PAGINATOR_TEMPLATE,
  pageLinkSize: TABLE_PAGE_LINK_SIZE,
} satisfies Partial<CuiDataTableProps>;
