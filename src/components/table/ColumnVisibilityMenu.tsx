'use client';

import type { Table } from '@tanstack/react-table';

export type ColumnVisibilityMenuProps<TData> = {
  table: Table<TData>;
};

/**
 * Column visibility dropdown for data tables.
 *
 * @param props - Column visibility configuration.
 * @returns Column visibility menu UI.
 * @throws {Error} Does not throw.
 */
export function ColumnVisibilityMenu<TData>({
  table,
}: ColumnVisibilityMenuProps<TData>) {
  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && column.id !== 'expander');

  if (columns.length === 0) {
    return null;
  }

  return (
    <details className="relative">
      <summary className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">
        Columns
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-56 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
        <div className="space-y-2">
          {columns.map((column) => {
            const label =
              typeof column.columnDef.header === 'string'
                ? column.columnDef.header
                : column.id;

            return (
              <label key={column.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={column.getToggleVisibilityHandler()}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </details>
  );
}
