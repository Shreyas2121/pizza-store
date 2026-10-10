import { TableSkeleton } from "@/shared/ui";
import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import {
  usePromotionAccess,
  useStorePromotions,
  usePromotionStoreContext,
} from "../api/promotion.queries";
import { usePromotionMutations } from "../api/promotion.mutations";
import {
  PROMOTION_LIST_DEFAULT_PAGE_SIZE,
  STORE_PROMOTION_REASON_MAX_LENGTH,
} from "../model/promotion.constants";
import { promotionErrorMessage } from "../model/promotion.helpers";
import { storePromotionSettingWriteSchema } from "../model/promotion.schemas";
import type {
  PromotionFilters,
  StorePromotion,
} from "../model/promotion.types";
import { PromotionDefinitionSummary } from "../components/promotion-definition-summary";
import {
  PromotionListControls,
  PromotionPagination,
} from "../components/promotion-list-controls";
import { PromotionStatusBadge } from "../components/promotion-status-badge";

const StorePromotionWorkspace = ({ storeId }: { storeId: number }) => {
  const { access } = usePromotionAccess();
  const store = access.data?.memberships.find(
    (membership) => membership.store.id === storeId,
  )?.store;
  const [filters, setFilters] = useState<PromotionFilters>({
    page: 1,
    pageSize: PROMOTION_LIST_DEFAULT_PAGE_SIZE,
  });
  const [target, setTarget] = useState<StorePromotion | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const query = useStorePromotions(storeId, filters);
  const storeContext = usePromotionStoreContext(storeId);
  const { toggle } = usePromotionMutations();
  const enabled = target ? !(target.explicitSetting?.enabled ?? true) : false;
  return (
    <Stack>
      <Title order={1}>Store promotions</Title>
      <Text>
        {store?.name ?? `Store #${storeId}`} · Stores participate by default.
        You may opt this store out or back in; global definitions are read-only.
      </Text>
      <Alert>
        Global deactivation, dates, limits and budget still apply. Re-enabling
        participation cannot override them. Existing online reservations retain
        their original terms.
      </Alert>
      <PromotionListControls filters={filters} onChange={setFilters} />
      <Button
        variant="default"
        loading={query.isFetching}
        onClick={() => void query.refetch()}
      >
        Refresh store participation
      </Button>
      {storeContext.data && (
        <Text size="sm">Store timezone: {storeContext.data.timezone}</Text>
      )}
      {storeContext.isError && (
        <Alert color="yellow">
          This store’s timezone could not be loaded.
          <Button variant="subtle" onClick={() => void storeContext.refetch()}>
            Retry store timezone
          </Button>
        </Alert>
      )}
      {query.isPending && <TableSkeleton toolbar={false} label="Loading store promotions" />}
      {query.isError && (
        <Alert color="red" role="alert">
          {promotionErrorMessage(query.error)}{" "}
          {query.data && "Displayed results may be stale."}
          <Button variant="subtle" onClick={() => void query.refetch()}>
            Retry store promotions
          </Button>
        </Alert>
      )}
      {query.isFetching && query.data && (
        <Text role="status">Refreshing store participation…</Text>
      )}
      {query.data && (
        <>
          {!query.data.items.length && (
            <Card withBorder>
              <Text>No promotions match these filters.</Text>
              {filters.page > 1 && (
                <Button
                  variant="light"
                  onClick={() => setFilters({ ...filters, page: 1 })}
                >
                  Return to first page
                </Button>
              )}
            </Card>
          )}
          {query.data.items.map((item) => (
            <Card withBorder key={item.promotion.id}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <div>
                    <Text fw={700}>{item.promotion.name}</Text>
                    <Text size="xs">
                      #{item.promotion.id} · {item.promotion.kind} · Definition
                      v{item.promotion.definitionVersion}
                    </Text>
                  </div>
                  <Group>
                    <PromotionStatusBadge status={item.promotion.status} />
                    <Badge
                      color={
                        item.effectiveStatus === "enabled" ? "green" : "gray"
                      }
                    >
                      {item.effectiveStatus.replace(/_/g, " ")}
                    </Badge>
                  </Group>
                </Group>
                <Text size="sm">
                  Participation choice:{" "}
                  {item.explicitSetting === null
                    ? "Enabled by default"
                    : item.explicitSetting.enabled
                    ? "Explicitly enabled"
                    : "Explicitly disabled"}
                </Text>
                {item.explicitSetting && (
                  <Text size="sm" c="dimmed">
                    Last change {item.explicitSetting.updatedAt} by user #
                    {item.explicitSetting.updatedByUserId}
                    {item.explicitSetting.reason
                      ? ` · ${item.explicitSetting.reason}`
                      : ""}
                  </Text>
                )}
                <details>
                  <summary className="cursor-pointer font-semibold">
                    Read global definition
                  </summary>
                  <div className="mt-3">
                    <PromotionDefinitionSummary
                      promotion={item.promotion}
                      timezone={storeContext.data?.timezone}
                    />
                  </div>
                </details>
                <Group justify="flex-end">
                  <Button
                    variant="light"
                    disabled={
                      !item.canToggle ||
                      query.isFetching ||
                      query.isError ||
                      toggle.isPending
                    }
                    onClick={() => {
                      setTarget(item);
                      setReason("");
                      setError(undefined);
                    }}
                  >
                    {item.explicitSetting?.enabled === false
                      ? "Re-enable"
                      : "Disable"}{" "}
                    participation for {item.promotion.name}
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
          <PromotionPagination
            page={query.data}
            pending={query.isFetching}
            onChange={(page) => setFilters({ ...filters, page })}
          />
        </>
      )}
      <Modal
        opened={target !== null}
        onClose={() => {
          if (!toggle.isPending) setTarget(null);
        }}
        title={`${enabled ? "Re-enable" : "Disable"} store participation?`}
        closeOnEscape={!toggle.isPending}
        closeOnClickOutside={!toggle.isPending}
        withCloseButton={!toggle.isPending}
      >
        <form
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            if (!target) return;
            const setting = {
              enabled,
              ...(reason.trim() ? { reason: reason.trim() } : {}),
            };
            const valid = storePromotionSettingWriteSchema.safeParse(setting);
            if (!valid.success) {
              setError(
                valid.error.issues.map((issue) => issue.message).join("; "),
              );
              return;
            }
            try {
              await toggle.mutateAsync({
                storeId,
                id: target.promotion.id,
                ...valid.data,
              });
              setTarget(null);
              setError(undefined);
            } catch (cause) {
              setError(promotionErrorMessage(cause));
            }
          }}
        >
          <Stack>
            <Text>
              {enabled ? "Re-enable" : "Disable"} {target?.promotion.name} for{" "}
              {store?.name ?? `Store #${storeId}`} only?
            </Text>
            {target?.promotion.isActive === false && (
              <Alert>
                This definition is globally inactive. Your participation choice
                will be retained when the platform reactivates it.
              </Alert>
            )}
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            <Textarea
              data-autofocus
              label={`Reason${enabled ? " (optional)" : ""}`}
              required={!enabled}
              maxLength={STORE_PROMOTION_REASON_MAX_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
              disabled={toggle.isPending}
            />
            <Group justify="flex-end">
              <Button
                type="button"
                variant="default"
                disabled={toggle.isPending}
                onClick={() => setTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color={enabled ? "green" : "red"}
                loading={toggle.isPending}
              >
                Confirm {enabled ? "re-enable" : "disable"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
};
export default function StorePromotionsPage() {
  const { manager, activeStoreId } = usePromotionAccess();
  return manager && activeStoreId ? (
    <StorePromotionWorkspace key={activeStoreId} storeId={activeStoreId} />
  ) : (
    <Alert color="red">
      Select a store where you are a manager with promotion participation
      permission.
    </Alert>
  );
}
