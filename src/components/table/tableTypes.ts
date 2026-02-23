import type { ReactNode } from 'react';

export type DataTableFilterOption = {
  label: string;
  value: string;
};

export type DataTableFilterConfig = {
  id: string;
  label: string;
  options: DataTableFilterOption[];
};

export type DataTableColumnConfig<TData> = {
  id: string;
  header: string;
  accessor: (row: TData) => string | number | null;
  cell?: (value: string | number | null, row: TData) => ReactNode;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  filterOptions?: DataTableFilterOption[];
  filterLabel?: string;
};
