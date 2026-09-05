import { useMemo, useState } from "react";
import { Tabs } from "@mantine/core";
import { Banknote, FileSearch, HandCoins, RotateCcw } from "lucide-react";
import { getActiveMembershipRole, hasStorePermission, useAccessMe, useStaffActiveStore } from "@/features/access";
import { EmptyState, PageHeader } from "@/shared/ui";
import { IssuesPanel } from "../components/issues-panel";
import { RefundsPanel } from "../components/refunds-panel";
import { SettlementsPanel } from "../components/settlements-panel";
import { CashSessionsPanel } from "../components/cash-sessions-panel";

export const FinanceWorkspacePage = () => {
  const { activeStoreId } = useStaffActiveStore();
  const { data: access } = useAccessMe();
  const [tab, setTab] = useState<string | null>("refunds");
  const canApprove = hasStorePermission(access, activeStoreId, "finance.refunds.approve");
  const canManage = hasStorePermission(access, activeStoreId, "finance.reconciliation.manage");
  const canReadSettlements = hasStorePermission(access, activeStoreId, "finance.settlements.read");
  const canManageCash = hasStorePermission(access, activeStoreId, "finance.cash.manage");
  const activeRole = getActiveMembershipRole(access, activeStoreId);
  const canReviewCash = activeRole === "admin" || activeRole === "manager" || activeRole === "finance_manager";
  const selectedStore = useMemo(
    () => access?.memberships.find((item) => item.store.id === activeStoreId)?.store.name,
    [access, activeStoreId]
  );

  if (!activeStoreId) return <>
    <PageHeader eyebrow="Finance operations" title="Cash, refunds & reconciliation" description="Select one store to work with COD cash, source transactions, and provider settlements." />
    <EmptyState icon={Banknote} title="Choose a store" description="Finance actions are store-scoped. Use the store selector in the header to continue." />
  </>;

  return <div className="space-y-5">
    <PageHeader eyebrow="Finance operations" title="Cash, refunds & reconciliation" description={`Auditable COD cash, refund decisions, and provider-to-local matching${selectedStore ? ` for ${selectedStore}` : ""}. Amounts are displayed exactly in INR.`} />
    <Tabs value={tab} onChange={setTab} keepMounted={false}>
      <Tabs.List aria-label="Finance workspace sections">
        <Tabs.Tab value="refunds" leftSection={<RotateCcw size={16} />}>Refunds</Tabs.Tab>
        {canManageCash && <Tabs.Tab value="cash" leftSection={<HandCoins size={16} />}>COD cash</Tabs.Tab>}
        {canReadSettlements && <Tabs.Tab value="settlements" leftSection={<Banknote size={16} />}>Settlements</Tabs.Tab>}
        {canReadSettlements && <Tabs.Tab value="issues" leftSection={<FileSearch size={16} />}>Issue queue</Tabs.Tab>}
      </Tabs.List>
      <Tabs.Panel value="refunds" pt="lg"><RefundsPanel storeId={activeStoreId} canApprove={canApprove} /></Tabs.Panel>
      {canManageCash && <Tabs.Panel value="cash" pt="lg"><CashSessionsPanel storeId={activeStoreId} canReview={canReviewCash} /></Tabs.Panel>}
      {canReadSettlements && <Tabs.Panel value="settlements" pt="lg"><SettlementsPanel storeId={activeStoreId} canManage={canManage} /></Tabs.Panel>}
      {canReadSettlements && <Tabs.Panel value="issues" pt="lg"><IssuesPanel storeId={activeStoreId} canManage={canManage} /></Tabs.Panel>}
    </Tabs>
  </div>;
};

export default FinanceWorkspacePage;
