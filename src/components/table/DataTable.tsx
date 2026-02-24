'use client';

import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  Row,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
} from '@/components/table/tableTypes';
import { TableToolbar } from '@/components/table/TableToolbar';

export type DataTableProps<TData> = {
  data: TData[];
  columnConfig: DataTableColumnConfig<TData>[];
  searchPlaceholder?: string;
  getRowId?: (row: TData) => string;
  getRowCanExpand?: (row: TData) => boolean;
  renderSubComponent?: (row: Row<TData>) => ReactNode;
};

/**
 * Reusable data table with sorting, filtering, and expandable rows.
 *
 * @param props - Data table configuration and data.
 * @returns Data table UI.
 * @throws {Error} Does not throw.
 */
export function DataTable<TData>({
  data,
  columnConfig,
  searchPlaceholder,
  getRowId,
  getRowCanExpand,
  renderSubComponent,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const filterableColumns = useMemo<DataTableFilterConfig[]>(() => {
    return columnConfig
      .filter((column) => column.filterOptions?.length)
      .map((column) => ({
        id: column.id,
        label: column.filterLabel ?? column.header,
        options: column.filterOptions ?? [],
      }));
  }, [columnConfig]);

  const columns = useMemo<ColumnDef<TData>[]>(() => {
    const mappedColumns = columnConfig.map<ColumnDef<TData>>((column) => ({
      id: column.id,
      header: column.header,
      accessorFn: (row) => column.accessor(row),
      cell: ({ getValue, row }) => {
        const value = getValue() as string | number | null;

        if (column.cell) {
          return column.cell(value, row.original);
        }

        return value === null || value === undefined ? '-' : String(value);
      },
      enableSorting: column.enableSorting ?? true,
      enableColumnFilter:
        column.enableFiltering ?? Boolean(column.filterOptions?.length),
      filterFn: column.filterOptions?.length
        ? (row, columnId, filterValue) => {
            if (!filterValue) {
              return true;
            }

            return String(row.getValue(columnId) ?? '') === String(filterValue);
          }
        : undefined,
    }));

    if (!renderSubComponent) {
      return mappedColumns;
    }

    const expanderColumn: ColumnDef<TData> = {
      id: 'expander',
      header: '',
      cell: ({ row }) => {
        if (!row.getCanExpand()) {
          return null;
        }

        return (
          <button
            type="button"
            onClick={row.getToggleExpandedHandler()}
            className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
          >
            {row.getIsExpanded() ? 'v' : '>'}
          </button>
        );
      },
      enableSorting: false,
      enableHiding: false,
    };

    return [expanderColumn, ...mappedColumns];
  }, [columnConfig, renderSubComponent]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      expanded,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getRowId: getRowId,
    getRowCanExpand: (row) => {
      if (!getRowCanExpand) {
        return false;
      }

      return getRowCanExpand(row.original);
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const normalizedValue = String(filterValue ?? '')
        .toLowerCase()
        .trim();
      const rowSearchValue = String(
        (row.original as { searchText?: string }).searchText ?? '',
      )
        .toLowerCase()
        .trim();

      if (!normalizedValue) {
        return true;
      }

      return rowSearchValue.includes(normalizedValue);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div>
      <TableToolbar
        table={table}
        searchPlaceholder={searchPlaceholder}
        filterableColumns={filterableColumns}
      />
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  if (header.isPlaceholder) {
                    return <th key={header.id} />;
                  }

                  const isSortable = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();

                  return (
                    <th key={header.id} className="px-4 py-3">
                      {isSortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-2 text-left"
                        >
                          <span>
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                          </span>
                          <span className="text-gray-400">
                            {sortDirection === 'asc'
                              ? '^'
                              : sortDirection === 'desc'
                                ? 'v'
                                : ''}
                          </span>
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-700">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && renderSubComponent && (
                  <tr>
                    <td
                      colSpan={row.getVisibleCells().length}
                      className="bg-gray-50 px-4 py-4"
                    >
                      {renderSubComponent(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">No results.</div>
        )}
      </div>
    </div>
  );
}
