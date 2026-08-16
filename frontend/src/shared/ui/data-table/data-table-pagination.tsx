import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { ActionIcon, Text } from "@mantine/core";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({ table }: DataTablePaginationProps<TData>) {
  const filtered = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <Text size="sm" c="dimmed">
        {filtered} {filtered === 1 ? "result" : "results"}
      </Text>
      <div className="flex items-center gap-2">
        <Text size="sm" fw={600} className="mr-2 tabular-nums">
          Page {table.getState().pagination.pageIndex + 1} of {pageCount}
        </Text>
        <ActionIcon
          variant="default"
          size={40}
          aria-label="Previous page"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeftIcon size={17} />
        </ActionIcon>
        <ActionIcon
          variant="default"
          size={40}
          aria-label="Next page"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRightIcon size={17} />
        </ActionIcon>
      </div>
    </div>
  );
}
