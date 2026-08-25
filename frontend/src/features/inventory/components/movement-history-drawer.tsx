import { Badge, Drawer, Pagination, Select, Table, Text } from "@mantine/core";
import { History } from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { TableSkeleton } from "@/shared/ui";
import { useInventoryMovements } from "../api/inventory.queries";
import type {
  InventoryChangeType,
  InventoryChangeTypeFilter,
  InventoryMutationTarget,
} from "../model/inventory.types";

type MovementHistoryDrawerProps = {
  storeId: number;
  target: InventoryMutationTarget;
  onClose: () => void;
};

const changeTypeOptions = [
  { value: "all", label: "All changes" },
  { value: "sale", label: "Sale" },
  { value: "restock", label: "Restock" },
  { value: "adjustment", label: "Adjustment" },
  { value: "return", label: "Return" },
  { value: "cancellation", label: "Cancellation" },
];

const changePresentation: Record<
  InventoryChangeType,
  { label: string; color: string }
> = {
  sale: { label: "Sale", color: "red" },
  restock: { label: "Restock", color: "basil" },
  adjustment: { label: "Adjustment", color: "blue" },
  return: { label: "Return", color: "teal" },
  cancellation: { label: "Cancellation", color: "orange" },
};

export function MovementHistoryDrawer({
  storeId,
  target,
  onClose,
}: MovementHistoryDrawerProps) {
  const [changeType, setChangeType] =
    useState<InventoryChangeTypeFilter>("all");
  const [page, setPage] = useState(1);
  const movements = useInventoryMovements({
    storeId,
    productId: target.productId,
    changeType,
    page,
    limit: 20,
  });

  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size="100%"
      title={`${target.productName} movement history`}
      overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
      classNames={{ content: "lg:max-w-[900px]" }}
    >
      <div className="mb-4 flex justify-end">
        <Select
          label="Change type"
          data={changeTypeOptions}
          value={changeType}
          onChange={(value) => {
            setChangeType(
              (value as InventoryChangeTypeFilter | null) ?? "all"
            );
            setPage(1);
          }}
          allowDeselect={false}
          className="w-full sm:w-56"
        />
      </div>

      {movements.isLoading ? (
        <TableSkeleton rows={8} />
      ) : movements.isError ? (
        <div className="empty-state m-0">
          <History size={32} className="text-brand" />
          <h3 className="mt-3 font-semibold text-ink">History unavailable</h3>
          <p className="mt-1 text-sm text-ink-muted">Refresh and try again.</p>
        </div>
      ) : !movements.data?.data.length ? (
        <div className="empty-state m-0">
          <History size={32} className="text-brand" />
          <h3 className="mt-3 font-semibold text-ink">No movements found</h3>
          <p className="mt-1 text-sm text-ink-muted">
            No {changeType === "all" ? "inventory" : changeType} changes have
            been recorded for this product.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="divide-y divide-border md:hidden">
            {movements.data.data.map((movement) => {
              const presentation = changePresentation[movement.changeType];
              const actor =
                [movement.actorFirstName, movement.actorLastName]
                  .filter(Boolean)
                  .join(" ") || "System";
              return (
                <article key={movement.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge color={presentation.color} variant="light">
                        {presentation.label}
                      </Badge>
                      <p className="mt-2 text-sm text-ink-muted">
                        {formatDateTime(movement.createdAt)} · {actor}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold tabular-nums ${
                          movement.quantityChange > 0
                            ? "text-basil"
                            : "text-danger"
                        }`}
                      >
                        {movement.quantityChange > 0 ? "+" : ""}
                        {movement.quantityChange}
                      </p>
                      <p className="text-xs text-ink-muted">
                        Result: {movement.newQuantity}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-ink">
                    {movement.reason || "No reason provided"}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
              <Table.Thead className="bg-surface-muted/70">
                <Table.Tr>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Change</Table.Th>
                  <Table.Th>Result</Table.Th>
                  <Table.Th>Reason</Table.Th>
                  <Table.Th>Actor</Table.Th>
                  <Table.Th>Date</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {movements.data.data.map((movement) => {
                  const presentation = changePresentation[movement.changeType];
                  const actor =
                    [movement.actorFirstName, movement.actorLastName]
                      .filter(Boolean)
                      .join(" ") || "System";
                  return (
                    <Table.Tr key={movement.id}>
                      <Table.Td>
                        <Badge color={presentation.color} variant="light">
                          {presentation.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td
                        className={`font-bold tabular-nums ${
                          movement.quantityChange > 0
                            ? "text-basil"
                            : "text-danger"
                        }`}
                      >
                        {movement.quantityChange > 0 ? "+" : ""}
                        {movement.quantityChange}
                      </Table.Td>
                      <Table.Td className="font-semibold tabular-nums">
                        {movement.newQuantity}
                      </Table.Td>
                      <Table.Td className="max-w-64 text-sm text-ink-muted">
                        {movement.reason || "—"}
                      </Table.Td>
                      <Table.Td className="whitespace-nowrap text-sm">{actor}</Table.Td>
                      <Table.Td className="whitespace-nowrap text-sm text-ink-muted">
                        {formatDateTime(movement.createdAt)}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Text size="sm" c="dimmed">
              {movements.data.meta.total} movements
            </Text>
            {movements.data.meta.totalPages > 1 && (
              <Pagination
                value={movements.data.meta.page}
                total={movements.data.meta.totalPages}
                onChange={setPage}
                size="sm"
                withEdges
              />
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
