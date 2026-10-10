import { PanelSkeleton, TableSkeleton } from "@/shared/ui";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  usePromotion,
  usePromotionAccess,
  usePromotions,
  usePromotionStoreContext,
} from "../api/promotion.queries";
import { usePromotionMutations } from "../api/promotion.mutations";
import { PROMOTION_LIST_DEFAULT_PAGE_SIZE } from "../model/promotion.constants";
import {
  describeDiscount,
  promotionErrorMessage,
} from "../model/promotion.helpers";
import type { Promotion, PromotionFilters } from "../model/promotion.types";
import { PromotionForm } from "../components/promotion-form";
import { PromotionImageUpload } from "../components/promotion-image-upload";
import { PromotionAnalyticsCard } from "../components/promotion-analytics-card";
import {
  PromotionListControls,
  PromotionPagination,
} from "../components/promotion-list-controls";
import { PromotionStatusBadge } from "../components/promotion-status-badge";

type Dialog =
  | { mode: "edit" | "media" | "analytics"; id: number }
  | { mode: "create"; id: 0 };
const PromotionDialog = ({
  dialog,
  storeId,
  timezone,
  onClose,
}: {
  dialog: Dialog;
  storeId?: number;
  timezone?: string;
  onClose: () => void;
}) => {
  const detail = usePromotion(dialog.id);
  if (dialog.mode === "create")
    return (
      <PromotionForm timezone={timezone} onSaved={onClose} onCancel={onClose} />
    );
  if (dialog.mode === "analytics")
    return <PromotionAnalyticsCard id={dialog.id} storeId={storeId} />;
  if (detail.isPending)
    return (
      <Stack>
        <PanelSkeleton label="Loading promotion definition" />
        <Button onClick={onClose}>Close</Button>
      </Stack>
    );
  if (!detail.data)
    return (
      <Stack>
        <Alert color="red">{promotionErrorMessage(detail.error)}</Alert>
        <Button onClick={() => void detail.refetch()}>Retry definition</Button>
        <Button onClick={onClose}>Close</Button>
      </Stack>
    );
  if (dialog.mode === "media")
    return <PromotionImageUpload promotion={detail.data} onClose={onClose} />;
  return (
    <Stack>
      {detail.isError && (
        <Alert color="red">
          The latest definition could not be refreshed. Your draft is preserved.
        </Alert>
      )}
      <PromotionForm
        timezone={timezone}
        promotion={detail.data}
        latestVersion={detail.data.definitionVersion}
        onSaved={onClose}
        onCancel={onClose}
        reload={async () => {
          const result = await detail.refetch({ throwOnError: true });
          return result.data;
        }}
      />
    </Stack>
  );
};

const AdminPromotionsWorkspace = ({ storeId }: { storeId?: number }) => {
  const [filters, setFilters] = useState<PromotionFilters>({
    page: 1,
    pageSize: PROMOTION_LIST_DEFAULT_PAGE_SIZE,
    ...(storeId ? { storeId } : {}),
  });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [deactivating, setDeactivating] = useState<Promotion | null>(null);
  const [error, setError] = useState<string>();
  const query = usePromotions(filters);
  const storeContext = usePromotionStoreContext(storeId ?? 0);
  const { deactivate } = usePromotionMutations();
  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={1}>Promotions</Title>
          <Text c="dimmed">
            Global definitions, schedules, media and budgets.
          </Text>
        </div>
        <Group>
          <Button
            variant="default"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh promotions
          </Button>
          <Button onClick={() => setDialog({ mode: "create", id: 0 })}>
            Create promotion
          </Button>
        </Group>
      </Group>
      {storeId && (
        <Alert>
          Showing global definitions with Store #{storeId} participation.
          Definition edits affect every store. Only that store’s manager changes
          participation.
        </Alert>
      )}
      <PromotionListControls filters={filters} onChange={setFilters} />
      {storeId && storeContext.isError && (
        <Alert color="yellow">
          The selected store’s timezone could not be loaded. Daily windows still
          use its configured timezone.
          <Button variant="subtle" onClick={() => void storeContext.refetch()}>
            Retry store timezone
          </Button>
        </Alert>
      )}
      {error && (
        <Alert
          color="red"
          role="alert"
          withCloseButton
          onClose={() => setError(undefined)}
        >
          {error}
        </Alert>
      )}
      {query.isPending && <TableSkeleton toolbar={false} label="Loading promotions" />}
      {query.isError && (
        <Alert color="red" role="alert">
          {promotionErrorMessage(query.error)}{" "}
          {query.data && "Displayed results may be stale."}
          <Button variant="subtle" onClick={() => void query.refetch()}>
            Retry promotions
          </Button>
        </Alert>
      )}
      {query.isFetching && query.data && (
        <Text role="status">Refreshing promotions…</Text>
      )}
      {query.data && (
        <>
          {!query.data.items.length ? (
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
          ) : (
            <Table.ScrollContainer minWidth={800}>
              <Table highlightOnHover>
                <Table.Caption>Global promotion definitions</Table.Caption>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Kind / discount</Table.Th>
                    <Table.Th>Status</Table.Th>
                    {storeId && <Table.Th>Store participation</Table.Th>}
                    <Table.Th>Version</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {query.data.items.map((promotion) => (
                    <Table.Tr key={promotion.id}>
                      <Table.Td>
                        <Text fw={600}>{promotion.name}</Text>
                        <Text size="xs" c="dimmed">
                          #{promotion.id}
                          {promotion.display.showOnHomepage
                            ? " · Homepage"
                            : ""}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {promotion.kind}
                        <Text size="sm">
                          {describeDiscount(promotion.discount)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <PromotionStatusBadge status={promotion.status} />
                      </Table.Td>
                      {storeId && (
                        <Table.Td>
                          {promotion.storeParticipation?.enabled
                            ? "Participating"
                            : "Opted out"}
                          {promotion.storeParticipation?.enabled &&
                          !promotion.storeParticipation.effectiveEnabled
                            ? " (globally inactive)"
                            : ""}
                        </Table.Td>
                      )}
                      <Table.Td>{promotion.definitionVersion}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button
                            size="compact-sm"
                            variant="light"
                            aria-label={`Edit ${promotion.name}`}
                            onClick={() =>
                              setDialog({ mode: "edit", id: promotion.id })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            size="compact-sm"
                            variant="subtle"
                            aria-label={`Manage media for ${promotion.name}`}
                            onClick={() =>
                              setDialog({ mode: "media", id: promotion.id })
                            }
                          >
                            Media
                          </Button>
                          <Button
                            size="compact-sm"
                            variant="subtle"
                            aria-label={`Analytics for ${promotion.name}`}
                            onClick={() =>
                              setDialog({ mode: "analytics", id: promotion.id })
                            }
                          >
                            Analytics
                          </Button>
                          <Button
                            size="compact-sm"
                            variant="subtle"
                            color="red"
                            disabled={
                              !promotion.isActive ||
                              query.isFetching ||
                              query.isError
                            }
                            aria-label={`Deactivate ${promotion.name}`}
                            onClick={() => setDeactivating(promotion)}
                          >
                            Deactivate
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
          <PromotionPagination
            page={query.data}
            pending={query.isFetching}
            onChange={(page) => setFilters({ ...filters, page })}
          />
        </>
      )}
      <Modal
        opened={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog
            ? `${
                dialog.mode === "create"
                  ? "Create promotion"
                  : dialog.mode === "edit"
                  ? "Edit promotion"
                  : dialog.mode === "media"
                  ? "Promotion media"
                  : "Promotion analytics"
              }${dialog.id ? ` #${dialog.id}` : ""}`
            : "Promotion"
        }
        size="xl"
        withCloseButton={dialog?.mode === "analytics"}
        closeOnClickOutside={dialog?.mode === "analytics"}
        closeOnEscape={dialog?.mode === "analytics"}
      >
        {dialog && (
          <PromotionDialog
            key={`${dialog.mode}:${dialog.id}`}
            dialog={dialog}
            storeId={storeId}
            timezone={storeContext.data?.timezone}
            onClose={() => setDialog(null)}
          />
        )}
      </Modal>
      <Modal
        opened={deactivating !== null}
        onClose={() => {
          if (!deactivate.isPending) setDeactivating(null);
        }}
        title="Deactivate global promotion?"
        withCloseButton={!deactivate.isPending}
        closeOnEscape={!deactivate.isPending}
        closeOnClickOutside={!deactivate.isPending}
      >
        <Stack>
          <Text>
            Deactivate {deactivating?.name} at every store for new quotes and
            orders? Existing reservations and order history keep their saved
            contract. Store participation choices are retained for reactivation.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={deactivate.isPending}
              onClick={() => setDeactivating(null)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={deactivate.isPending}
              onClick={async () => {
                if (!deactivating) return;
                try {
                  await deactivate.mutateAsync(deactivating.id);
                  setDeactivating(null);
                } catch (cause) {
                  setError(promotionErrorMessage(cause));
                  setDeactivating(null);
                }
              }}
            >
              Deactivate globally
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
export default function AdminPromotionsPage() {
  const { admin, activeStoreId } = usePromotionAccess();
  return admin ? (
    <AdminPromotionsWorkspace
      key={activeStoreId ?? "global"}
      storeId={activeStoreId ?? undefined}
    />
  ) : (
    <Alert color="red">
      Platform promotion management permission is required.
    </Alert>
  );
}
