import {
  flexRender,
  useTable,
  type ColumnFiltersState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ReactElement, ReactNode, useState } from "react";
import DataTableSearch from "./data-table-search";
import { Table, UnstyledButton } from "@mantine/core";
import { ArrowDown, ArrowUp, ChevronsUpDown, SearchX } from "lucide-react";
import { DataTablePagination } from "./data-table-pagination";
import {
  dataTableFeatures,
  type DataTableColumnDef,
} from "./data-table-features";

interface DataTableProps<TData extends RowData> {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  keyName?: string;
  text?: string;
  searchLabel?: string;
  Component?: ReactElement;
  emptyTitle?: string;
  emptyDescription?: string;
  renderMobileCard?: (item: TData) => ReactNode;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  keyName,
  text = "records",
  searchLabel = "Search",
  Component,
  emptyTitle = "No results found",
  emptyDescription = "Try changing your search or filters.",
  renderMobileCard,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
  });

  const rows = table.getRowModel().rows;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      {(keyName || Component) && (
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:justify-between">
          {keyName ? (
            <DataTableSearch
              label={searchLabel}
              onChange={(event) => table.getColumn(keyName)?.setFilterValue(event.target.value)}
              value={(table.getColumn(keyName)?.getFilterValue() as string) ?? ""}
              placeholder={`Search ${text}`}
            />
          ) : <span />}
          {Component}
        </div>
      )}

      {renderMobileCard && (
        <div className="divide-y divide-border md:hidden">
          {rows.length ? rows.map((row) => (
            <div key={row.id} className="p-4">{renderMobileCard(row.original)}</div>
          )) : (
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <SearchX className="mb-3 text-ink-muted" size={28} />
              <p className="font-semibold text-ink">{emptyTitle}</p>
              <p className="mt-1 text-sm text-ink-muted">{emptyDescription}</p>
            </div>
          )}
        </div>
      )}

      <div className={`${renderMobileCard ? "hidden md:block" : "block"} overflow-x-auto`}>
        <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
          <Table.Thead className="bg-surface-muted/70">
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <Table.Th key={header.id} className="whitespace-nowrap text-xs uppercase tracking-wide text-ink-muted">
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <UnstyledButton
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex min-h-9 items-center gap-1.5 font-semibold"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? <ArrowUp size={14} /> : sorted === "desc" ? <ArrowDown size={14} /> : <ChevronsUpDown size={14} className="opacity-45" />}
                        </UnstyledButton>
                      ) : flexRender(header.column.columnDef.header, header.getContext())}
                    </Table.Th>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Thead>
          <Table.Tbody>
            {rows.length ? rows.map((row) => (
              <Table.Tr key={row.id} className="h-[52px]">
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Td>
                ))}
              </Table.Tr>
            )) : (
              <Table.Tr>
                <Table.Td colSpan={columns.length} className="py-14 text-center">
                  <div className="flex flex-col items-center">
                    <SearchX className="mb-3 text-ink-muted" size={28} />
                    <p className="font-semibold text-ink">{emptyTitle}</p>
                    <p className="mt-1 text-sm text-ink-muted">{emptyDescription}</p>
                  </div>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </section>
  );
}
