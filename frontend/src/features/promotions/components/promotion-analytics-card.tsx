import { CardGridSkeleton } from "@/shared/ui";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { usePromotionAnalytics } from "../api/promotion.queries";
import { promotionAnalyticsQuerySchema } from "../model/promotion.schemas";
import {
  formatPromotionAggregate,
  promotionErrorMessage,
} from "../model/promotion.helpers";
import { IntegerField } from "./promotion-fields";
import type { AnalyticsFilters } from "../model/promotion.types";

export const PromotionAnalyticsCard = ({
  id,
  storeId,
}: {
  id: number;
  storeId?: number;
}) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedStore, setSelectedStore] = useState<number | null>(
    storeId ?? null,
  );
  const [filters, setFilters] = useState<AnalyticsFilters>(
    storeId ? { storeId } : {},
  );
  const [error, setError] = useState<string>();
  const query = usePromotionAnalytics(id, filters);
  const totals = query.data?.totals;
  return (
    <Stack>
      <Text size="sm">
        Inclusive order business dates. Counts reflect current application
        state; savings and influenced payable value include consumed
        applications. Revenue reduction is tax-exclusive item attribution, not a
        delivered-ledger report. Reservations do not recognize revenue.
      </Text>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = {
            ...(from ? { fromBusinessDate: from } : {}),
            ...(to ? { toBusinessDate: to } : {}),
            ...(selectedStore !== null ? { storeId: selectedStore } : {}),
          };
          const result = promotionAnalyticsQuerySchema.safeParse(next);
          if (!result.success) {
            setError(
              result.error.issues.map((issue) => issue.message).join("; "),
            );
            return;
          }
          setError(undefined);
          setFilters(next);
        }}
      >
        <Group align="end">
          <TextInput
            label="From business date"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <TextInput
            label="To business date"
            type="date"
            value={to}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
          <IntegerField
            label="Store ID (optional)"
            value={selectedStore}
            onChange={(value) =>
              setSelectedStore(Number.isNaN(value) ? null : value)
            }
            min={1}
          />
          <Button type="submit">Apply analytics filters</Button>
        </Group>
      </form>
      {error && (
        <Alert role="alert" color="red">
          {error}
        </Alert>
      )}
      {query.isPending && <CardGridSkeleton count={3} height={110} className="grid gap-3 sm:grid-cols-3" label="Loading promotion analytics" />}
      {query.isError && (
        <Alert color="red" role="alert">
          {promotionErrorMessage(query.error)}{" "}
          <Button variant="subtle" onClick={() => void query.refetch()}>
            Retry analytics
          </Button>
        </Alert>
      )}
      {query.isFetching && query.data && (
        <Text role="status">Refreshing analytics…</Text>
      )}
      {totals && query.data && (
        <>
          <Text size="sm">
            {query.data.fromBusinessDate} through {query.data.toBusinessDate}
            {filters.storeId ? ` · Store #${filters.storeId}` : " · All stores"}
          </Text>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Reserved applications", totals.reservedApplications],
              ["Consumed applications", totals.consumedApplications],
              ["Released applications", totals.releasedApplications],
              ["Unique consumed users", totals.uniqueUsers],
              [
                "Item discounts",
                formatPromotionAggregate(totals.itemDiscountPaise),
              ],
              [
                "Delivery savings",
                formatPromotionAggregate(totals.deliveryDiscountPaise),
              ],
              [
                "Total savings",
                formatPromotionAggregate(totals.totalSavingsPaise),
              ],
              [
                "Influenced payable order value",
                formatPromotionAggregate(totals.influencedOrderValuePaise),
              ],
              [
                "Tax-exclusive item revenue reduction",
                formatPromotionAggregate(totals.netRevenueReductionPaise),
              ],
            ].map(([label, value]) => (
              <Card withBorder key={label}>
                <Text size="sm" c="dimmed">
                  {label}
                </Text>
                <Text fw={700}>{value}</Text>
              </Card>
            ))}
          </div>
          {!query.data.stores.length ? (
            <Text>No consumed or reserved applications in this range.</Text>
          ) : (
            <Table.ScrollContainer minWidth={850}>
              <Table captionSide="top">
                <Table.Caption>
                  Per-store consumed application attribution
                </Table.Caption>
                <Table.Thead>
                  <Table.Tr>
                    {[
                      "Store",
                      "Consumed",
                      "Unique users",
                      "Item discounts",
                      "Delivery savings",
                      "Total savings",
                      "Influenced payable value",
                      "Revenue reduction",
                    ].map((heading) => (
                      <Table.Th key={heading}>{heading}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {query.data.stores.map((store) => (
                    <Table.Tr key={store.storeId}>
                      <Table.Td>
                        {store.storeName} (#{store.storeId})
                      </Table.Td>
                      <Table.Td>{store.consumedApplications}</Table.Td>
                      <Table.Td>{store.uniqueUsers}</Table.Td>
                      {[
                        store.itemDiscountPaise,
                        store.deliveryDiscountPaise,
                        store.totalSavingsPaise,
                        store.influencedOrderValuePaise,
                        store.netRevenueReductionPaise,
                      ].map((value, index) => (
                        <Table.Td key={index}>
                          {formatPromotionAggregate(value)}
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </>
      )}
    </Stack>
  );
};
