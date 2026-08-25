import {
  ActionIcon,
  Badge,
  Button,
  Menu,
  Pagination,
  Table,
  Text,
} from "@mantine/core";
import { MoreHorizontal, PackagePlus, Pencil, SlidersHorizontal } from "lucide-react";
import { BASE_URL } from "@/shared/config";
import { formatDateTime } from "@/shared/lib";
import { RefreshIndicator } from "@/shared/ui";
import type {
  InventoryAction,
  InventoryItem,
  InventoryMeta,
} from "../model/inventory.types";

type InventoryTableProps = {
  items: InventoryItem[];
  meta: InventoryMeta;
  isRefreshing: boolean;
  onPageChange: (page: number) => void;
  onAction: (item: InventoryItem, action: InventoryAction) => void;
};

const statusPresentation = {
  untracked: { label: "Untracked", color: "gray" },
  in_stock: { label: "In stock", color: "basil" },
  low_stock: { label: "Low stock", color: "yellow" },
  out_of_stock: { label: "Out of stock", color: "red" },
} as const;

const quantity = (value: number | null) => value ?? "—";

function InventoryActions({
  item,
  onAction,
}: {
  item: InventoryItem;
  onAction: InventoryTableProps["onAction"];
}) {
  return (
    <Menu position="bottom-end" shadow="md" width={190}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${item.productName}`}>
          <MoreHorizontal size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<PackagePlus size={16} />}
          onClick={() => onAction(item, "restock")}
        >
          Restock
        </Menu.Item>
        <Menu.Item
          leftSection={<Pencil size={16} />}
          onClick={() => onAction(item, "adjust")}
        >
          Adjust stock
        </Menu.Item>
        <Menu.Item
          leftSection={<SlidersHorizontal size={16} />}
          onClick={() => onAction(item, "threshold")}
        >
          Edit threshold
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
export function InventoryTable({
  items,
  meta,
  isRefreshing,
  onPageChange,
  onAction,
}: InventoryTableProps) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
      aria-busy={isRefreshing}
    >
      <RefreshIndicator active={isRefreshing} label="Refreshing inventory" />

      <div className="divide-y divide-border md:hidden">
        {items.map((item) => {
          const status = statusPresentation[item.stockStatus];
          return (
            <article key={item.storeProductId} className="p-4">
              <div className="flex items-start gap-3">
                <img
                  src={`${BASE_URL}${item.productImage}`}
                  alt=""
                  className="h-12 w-12 rounded-lg border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{item.productName}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge size="sm" color={status.color} variant="light">
                      {status.label}
                    </Badge>
                    {(!item.isAvailable || !item.productIsAvailable) && (
                      <Badge size="sm" color="gray" variant="outline">
                        Manually unavailable
                      </Badge>
                    )}
                  </div>
                </div>
                <InventoryActions item={item} onAction={onAction} />
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-2 rounded-lg bg-surface-muted p-3 text-center">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">On-hand</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-ink">
                    {quantity(item.onHandQuantity)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Reserved</dt>
                  <dd className="mt-1 tabular-nums text-ink-muted">{item.reservedQuantity}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Available</dt>
                  <dd className="mt-1 font-bold tabular-nums text-brand">
                    {quantity(item.availableQuantity)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Threshold</dt>
                  <dd className="mt-1 tabular-nums text-ink">{item.lowStockThreshold}</dd>
                </div>
              </dl>
              <Text size="xs" c="dimmed" mt="sm">
                Last restocked: {item.lastRestockedAt ? formatDateTime(item.lastRestockedAt) : "Never"}
              </Text>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
          <Table.Thead className="bg-surface-muted/70">
            <Table.Tr>
              {[
                "Product",
                "On-hand",
                "Reserved",
                "Available",
                "Threshold",
                "Status",
                "Last restocked",
                "",
              ].map((heading, index) => (
                <Table.Th
                  key={`${heading}-${index}`}
                  className="whitespace-nowrap text-xs uppercase tracking-wide text-ink-muted"
                >
                  {heading}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => {
              const status = statusPresentation[item.stockStatus];
              return (
                <Table.Tr key={item.storeProductId}>
                  <Table.Td>
                    <div className="flex min-w-52 items-center gap-3">
                      <img
                        src={`${BASE_URL}${item.productImage}`}
                        alt=""
                        className="h-10 w-10 rounded-lg border border-border object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{item.productName}</p>
                        {(!item.isAvailable || !item.productIsAvailable) && (
                          <p className="text-xs text-ink-muted">Manually unavailable</p>
                        )}
                      </div>
                    </div>
                  </Table.Td>
                  <Table.Td className="font-semibold tabular-nums text-ink">
                    {quantity(item.onHandQuantity)}
                  </Table.Td>
                  <Table.Td className="tabular-nums text-ink-muted">
                    {item.reservedQuantity}
                  </Table.Td>
                  <Table.Td className="font-bold tabular-nums text-brand">
                    {quantity(item.availableQuantity)}
                  </Table.Td>
                  <Table.Td className="tabular-nums">{item.lowStockThreshold}</Table.Td>
                  <Table.Td>
                    <Badge color={status.color} variant="light">
                      {status.label}
                    </Badge>
                  </Table.Td>
                  <Table.Td className="whitespace-nowrap text-sm text-ink-muted">
                    {item.lastRestockedAt ? formatDateTime(item.lastRestockedAt) : "Never"}
                  </Table.Td>
                  <Table.Td>
                    <InventoryActions item={item} onAction={onAction} />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Text size="sm" c="dimmed">
          {meta.total} {meta.total === 1 ? "product" : "products"}
        </Text>
        {meta.totalPages > 1 && (
          <Pagination
            value={meta.page}
            total={meta.totalPages}
            onChange={onPageChange}
            size="sm"
            withEdges
          />
        )}
        {meta.totalPages <= 1 && meta.total > 0 && (
          <Button variant="subtle" size="compact-sm" disabled>
            Page 1 of 1
          </Button>
        )}
      </div>
    </section>
  );
}
