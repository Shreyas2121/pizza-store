import { Button, Group, Select, Text } from "@mantine/core";
import {
  PROMOTION_DERIVED_STATUSES,
  PROMOTION_LIST_MAX_PAGE,
  PROMOTION_PAGE_SIZE_OPTIONS,
} from "../model/promotion.constants";
import type { PromotionFilters, PromotionPage } from "../model/promotion.types";

export const PromotionListControls = ({
  filters,
  onChange,
}: {
  filters: PromotionFilters;
  onChange: (filters: PromotionFilters) => void;
}) => (
  <Group align="end">
    <Select
      label="Kind filter"
      value={filters.kind ?? "all"}
      allowDeselect={false}
      data={[
        { value: "all", label: "All kinds" },
        { value: "offer", label: "Offers" },
        { value: "coupon", label: "Coupons" },
      ]}
      onChange={(kind) =>
        onChange({
          ...filters,
          page: 1,
          kind: kind === "offer" || kind === "coupon" ? kind : undefined,
        })
      }
    />
    <Select
      label="Global status filter"
      value={filters.status ?? "all"}
      allowDeselect={false}
      data={[
        { value: "all", label: "All statuses" },
        ...PROMOTION_DERIVED_STATUSES.map((status) => ({
          value: status,
          label: status,
        })),
      ]}
      onChange={(status) => {
        switch (status) {
          case "scheduled":
          case "active":
          case "expired":
          case "exhausted":
          case "inactive":
            onChange({ ...filters, page: 1, status });
            break;
          default:
            onChange({ ...filters, page: 1, status: undefined });
        }
      }}
    />
    <Select
      label="Results per page"
      value={String(filters.pageSize)}
      allowDeselect={false}
      data={PROMOTION_PAGE_SIZE_OPTIONS.map(String)}
      onChange={(size) => {
        if (size) onChange({ ...filters, page: 1, pageSize: Number(size) });
      }}
    />
  </Group>
);
export const PromotionPagination = ({
  page,
  pending,
  onChange,
}: {
  page: PromotionPage<unknown>;
  pending: boolean;
  onChange: (page: number) => void;
}) => (
  <Group justify="space-between">
    <Text size="sm">
      {page.totalItems} results · Page {page.page} of{" "}
      {Math.max(1, page.totalPages)}
    </Text>
    <Group>
      <Button
        variant="default"
        disabled={pending || page.page <= 1}
        onClick={() => onChange(page.page - 1)}
      >
        Previous page
      </Button>
      <Button
        variant="default"
        disabled={
          pending ||
          page.page >= page.totalPages ||
          page.page >= PROMOTION_LIST_MAX_PAGE
        }
        onClick={() => onChange(page.page + 1)}
      >
        Next page
      </Button>
    </Group>
  </Group>
);
