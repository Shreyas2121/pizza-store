import { useMemo, useState } from "react";
import { Tabs } from "@mantine/core";
import { Banknote, Calculator, FileSearch, HandCoins, ReceiptText, RotateCcw, Tags } from "lucide-react";
import { getActiveMembershipRole, hasStorePermission, isPlatformAdmin, useAccessMe, useStaffActiveStore } from "@/features/access";
import { EmptyState, PageHeader } from "@/shared/ui";
import { IssuesPanel } from "../components/issues-panel";
import { RefundsPanel } from "../components/refunds-panel";
import { SettlementsPanel } from "../components/settlements-panel";
import { CashSessionsPanel } from "../components/cash-sessions-panel";
import { CostsPanel } from "../components/costs-panel";
import { VendorsPanel } from "../components/vendors-panel";
import { ExpensesPanel } from "../components/expenses-panel";

export const FinanceWorkspacePage = () => {
  const { activeStoreId } = useStaffActiveStore();
  const { data: access } = useAccessMe();
  const [tab, setTab] = useState<string | null>(null);
  const canReadRefunds = hasStorePermission(access, activeStoreId, "finance.refunds.create");
  const canApprove = hasStorePermission(access, activeStoreId, "finance.refunds.approve");
  const canManage = hasStorePermission(access, activeStoreId, "finance.reconciliation.manage");
  const canReadSettlements = hasStorePermission(access, activeStoreId, "finance.settlements.read");
  const canManageCash = hasStorePermission(access, activeStoreId, "finance.cash.manage");
  const canReadCosts = hasStorePermission(access, activeStoreId, "finance.costs.read");
  const canManageCosts = hasStorePermission(access, activeStoreId, "finance.costs.manage");
  const canReadExpenses = hasStorePermission(access, activeStoreId, "finance.expenses.read");
  const canCreateExpenses = hasStorePermission(access, activeStoreId, "finance.expenses.create");
  const canApproveExpenses = hasStorePermission(access, activeStoreId, "finance.expenses.approve");
  const canPayExpenses = hasStorePermission(access, activeStoreId, "finance.expenses.pay");
  const activeRole = getActiveMembershipRole(access, activeStoreId);
  const canReviewCash = activeRole === "admin" || activeRole === "manager" || activeRole === "finance_manager";
  const selectedStore = useMemo(
    () => access?.memberships.find((item) => item.store.id === activeStoreId)?.store.name,
    [access, activeStoreId]
  );
  const availableTabs = [canReadRefunds && "refunds", canReadExpenses && "expenses", canReadExpenses && "masters", canReadCosts && "costs", canManageCash && "cash", canReadSettlements && "settlements", canReadSettlements && "issues"].filter((value): value is string => Boolean(value));
  const selectedTab = tab && availableTabs.includes(tab) ? tab : availableTabs[0] ?? null;

  if (!activeStoreId) return <>
    <PageHeader eyebrow="Finance operations" title="Store finance workspace" description="Select one store to work with costs, expenses, cash, refunds, and provider settlements." />
    <EmptyState icon={Banknote} title="Choose a store" description="Finance actions are store-scoped. Use the store selector in the header to continue." />
  </>;

  return <div className="space-y-5">
    <PageHeader eyebrow="Finance operations" title="Store finance workspace" description={`Auditable source costs, expenses, COD cash, refunds, and reconciliation${selectedStore ? ` for ${selectedStore}` : ""}. Amounts are displayed exactly in INR.`} />
    <Tabs value={selectedTab} onChange={setTab} keepMounted={false}>
      <Tabs.List aria-label="Finance workspace sections">
        {canReadRefunds && <Tabs.Tab value="refunds" leftSection={<RotateCcw size={16} />}>Refunds</Tabs.Tab>}
        {canReadExpenses && <Tabs.Tab value="expenses" leftSection={<ReceiptText size={16} />}>Expenses</Tabs.Tab>}
        {canReadExpenses && <Tabs.Tab value="masters" leftSection={<Tags size={16} />}>Vendors & categories</Tabs.Tab>}
        {canReadCosts && <Tabs.Tab value="costs" leftSection={<Calculator size={16} />}>Standard costs</Tabs.Tab>}
        {canManageCash && <Tabs.Tab value="cash" leftSection={<HandCoins size={16} />}>COD cash</Tabs.Tab>}
        {canReadSettlements && <Tabs.Tab value="settlements" leftSection={<Banknote size={16} />}>Settlements</Tabs.Tab>}
        {canReadSettlements && <Tabs.Tab value="issues" leftSection={<FileSearch size={16} />}>Issue queue</Tabs.Tab>}
      </Tabs.List>
      {canReadRefunds && <Tabs.Panel value="refunds" pt="lg"><RefundsPanel storeId={activeStoreId} canApprove={canApprove} /></Tabs.Panel>}
      {canReadExpenses && <Tabs.Panel value="expenses" pt="lg"><ExpensesPanel storeId={activeStoreId} canCreate={canCreateExpenses} canApprove={canApproveExpenses} canPay={canPayExpenses} /></Tabs.Panel>}
      {canReadExpenses && <Tabs.Panel value="masters" pt="lg"><VendorsPanel storeId={activeStoreId} canManage={canCreateExpenses} canManagePlatform={isPlatformAdmin(access)} /></Tabs.Panel>}
      {canReadCosts && <Tabs.Panel value="costs" pt="lg"><CostsPanel storeId={activeStoreId} canManage={canManageCosts} /></Tabs.Panel>}
      {canManageCash && <Tabs.Panel value="cash" pt="lg"><CashSessionsPanel storeId={activeStoreId} canReview={canReviewCash} /></Tabs.Panel>}
      {canReadSettlements && <Tabs.Panel value="settlements" pt="lg"><SettlementsPanel storeId={activeStoreId} canManage={canManage} /></Tabs.Panel>}
      {canReadSettlements && <Tabs.Panel value="issues" pt="lg"><IssuesPanel storeId={activeStoreId} canManage={canManage} /></Tabs.Panel>}
    </Tabs>
  </div>;
};

export default FinanceWorkspacePage;
