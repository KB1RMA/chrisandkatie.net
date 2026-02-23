'use client';

import type { ChangeEvent } from 'react';
import type { Table } from '@tanstack/react-table';
import { ColumnVisibilityMenu } from '@/components/table/ColumnVisibilityMenu';
import type { DataTableFilterConfig } from '@/components/table/tableTypes';

export type TableToolbarProps<TData> = {
  table: Table<TData>;
  searchPlaceholder?: string;
  filterableColumns?: DataTableFilterConfig[];
};

/**
 * Toolbar for data tables with search, filters, and column visibility.
 *
 * @param props - Toolbar configuration and table instance.
 * @returns Toolbar UI for the table.
 * @throws {Error} Does not throw.
 */
export function TableToolbar<TData>({
  table,
  searchPlaceholder = 'Search',
  filterableColumns = [],
}: TableToolbarProps<TData>) {
  const globalFilterValue = String(table.getState().globalFilter ?? '');
  const visibleFilters = filterableColumns.filter((filter) =>
    Boolean(table.getColumn(filter.id)),
  );

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    table.setGlobalFilter(event.target.value);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Search
          </label>
          <input
            type="text"
            value={globalFilterValue}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            className="w-full sm:w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9e3f3f]"
          />
        </div>
        {visibleFilters.map((filter) => {
          const column = table.getColumn(filter.id);

          if (!column) {
            return null;
          }

          const selectedValue = String(column.getFilterValue() ?? '');

          const handleFilterChange = (
            event: ChangeEvent<HTMLSelectElement>,
          ) => {
            const value = event.target.value;

            if (value) {
              column.setFilterValue(value);

              return;
            }

            column.setFilterValue(undefined);
          };

          return (
            <div key={filter.id}>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {filter.label}
              </label>
              <select
                value={selectedValue}
                onChange={handleFilterChange}
                className="w-full sm:w-48 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9e3f3f]"
              >
                <option value="">All</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      <ColumnVisibilityMenu table={table} />
    </div>
  );
}
