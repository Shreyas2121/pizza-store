import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Group, Select, Tabs, Text, TextInput } from "@mantine/core";
import { Banknote, BookOpen, Calculator, ChartNoAxesCombined, FileChartColumn, FileSearch, HandCoins, Landmark, ReceiptText, RotateCcw, Tags } from "lucide-react";
import { useSearchParams } from "react-router";
import { getActiveMembershipRole, hasStorePermission, isPlatformAdmin, useAccessMe, useStaffActiveStore } from "@/features/access";
import { EmptyState, PageHeader } from "@/shared/ui";
import { RealtimeEvents, useSocketEvent } from "@/shared/realtime";
import { IssuesPanel } from "../components/issues-panel";
import { RefundsPanel } from "../components/refunds-panel";
import { SettlementsPanel } from "../components/settlements-panel";
import { CashSessionsPanel } from "../components/cash-sessions-panel";
import { CostsPanel } from "../components/costs-panel";
import { VendorsPanel } from "../components/vendors-panel";
import { ExpensesPanel } from "../components/expenses-panel";
import { LedgerPanel } from "../components/ledger-panel";
import { FinanceOverviewPanel, FinanceProfitAndLossPanel, FinanceSalesMarginsPanel, PaymentsSummary, type FinanceDrillDown } from "../components/finance-report-panels";
import { JournalDrillDown } from "../components/journal-drilldown";
import { PeriodClosePanel } from "../components/period-close-panel";
import { FinanceExportButtons } from "../components/finance-export-buttons";
import { financeKeys, type FinanceExportType } from "../api/finance.queries";
import type { FinanceReportGroup, JournalFilters, LedgerAccountType } from "../model/finance.types";

const defaultDates = () => {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  return { from, to };
};
const split = (value: string | null) => value?.split(",").filter(Boolean);

export const FinanceWorkspacePage = () => {
  const queryClient = useQueryClient();
  const { activeStoreId } = useStaffActiveStore();
  const { data: access } = useAccessMe();
  const [params, setParams] = useSearchParams();
  const owner = isPlatformAdmin(access);
  const defaults = defaultDates();
  const from = params.get("from") ?? defaults.from;
  const to = params.get("to") ?? defaults.to;
  const groupBy = (params.get("groupBy") ?? "month") as FinanceReportGroup;
  const consolidated = owner && params.get("scope") !== "store";
  const refreshFinanceForStore = (storeId: number) => {
    if (consolidated || activeStoreId === storeId) {
      void queryClient.invalidateQueries({ queryKey: financeKeys.all });
    }
  };
  useSocketEvent(RealtimeEvents.refundStatusChanged, (event) => {
    refreshFinanceForStore(event.storeId);
  });
  useSocketEvent(RealtimeEvents.expenseStatusChanged, (event) => {
    refreshFinanceForStore(event.storeId);
  });
  const reportStoreId: number | null | undefined = owner ? (consolidated ? null : activeStoreId ?? undefined) : activeStoreId ?? undefined;
  const canOverview = hasStorePermission(access, activeStoreId, "finance.overview.read");
  const canSales = hasStorePermission(access, activeStoreId, "finance.sales.read");
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
  const canReadLedger = hasStorePermission(access, activeStoreId, "finance.ledger.read");
  const canPostLedger = hasStorePermission(access, activeStoreId, "finance.ledger.post");
  const activeRole = getActiveMembershipRole(access, activeStoreId);
  const canReviewCash = activeRole === "admin" || activeRole === "manager" || activeRole === "finance_manager";
  const selectedStore = useMemo(() => access?.memberships.find((item) => item.store.id === activeStoreId)?.store.name, [access, activeStoreId]);
  const availableTabs = [canOverview && "overview", canOverview && "pnl", canSales && "sales-margin", canReadRefunds && "refunds", canReadExpenses && "expenses", canReadSettlements && "settlements", canManageCash && "cash", canReadLedger && "ledger", canReadLedger && "close", canReadSettlements && "issues", (canReadCosts || canReadExpenses) && "configuration"].filter((value): value is string => Boolean(value));
  const requestedTab = params.get("tab");
  const selectedTab = requestedTab && availableTabs.includes(requestedTab) ? requestedTab : availableTabs[0] ?? null;
  const exportTypes: FinanceExportType[] = selectedTab === "overview"
    ? ["overview"]
    : selectedTab === "pnl"
      ? ["profit-and-loss"]
      : selectedTab === "sales-margin"
        ? ["sales", "margins"]
        : [];
  const setParam = (key: string, value?: string) => setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });
  const setTab = (value: string | null) => setParam("tab", value ?? undefined);

  const drillFilters: JournalFilters | null = params.get("drill") === "1" ? {
    from: params.get("journalFrom") ?? undefined,
    to: params.get("journalTo") ?? undefined,
    accountCodes: split(params.get("accountCodes")),
    excludeAccountCodes: split(params.get("excludeAccountCodes")),
    accountTypes: split(params.get("accountTypes")) as LedgerAccountType[] | undefined,
    eventType: params.get("eventType") ?? undefined,
    sourceType: params.get("sourceType") ?? undefined,
    sourceId: params.get("sourceId") ?? undefined,
  } : null;

  const drillDown = (target: FinanceDrillDown) => {
    const filters = { ...target.filters };
    if (!("from" in filters)) filters.from = from;
    if (!("to" in filters)) filters.to = to;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", target.tab);
      if (target.tab === "ledger") next.set("drill", "1"); else next.delete("drill");
      const values: Record<string, string | undefined> = {
        journalFrom: filters.from, journalTo: filters.to, accountCodes: filters.accountCodes?.join(","), excludeAccountCodes: filters.excludeAccountCodes?.join(","), accountTypes: filters.accountTypes?.join(","), eventType: filters.eventType, sourceType: filters.sourceType, sourceId: filters.sourceId,
      };
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  };
  const clearDrill = () => setParams((current) => { const next = new URLSearchParams(current); for (const key of ["drill", "journalFrom", "journalTo", "accountCodes", "excludeAccountCodes", "accountTypes", "eventType", "sourceType", "sourceId"]) next.delete(key); return next; });

  if (!owner && !activeStoreId) return <><PageHeader eyebrow="Finance" title="Finance workspace" description="Select one store to view management reports and finance operations." /><EmptyState icon={Banknote} title="Choose a store" description="Finance access and actions are store-scoped." /></>;

  const reports = { storeId: reportStoreId, from, to, groupBy, onDrillDown: drillDown };
  return <div className="space-y-5">
    <PageHeader eyebrow="Management accounting" title="Finance workspace" description={`Ledger-backed performance, cash, expenses, refunds, and close controls${consolidated ? " across all stores" : selectedStore ? ` for ${selectedStore}` : ""}. Amounts are exact INR.`} />
    {(canOverview || canSales) && <Group align="end" wrap="wrap"><TextInput type="date" label="From" value={from} onChange={(event) => setParam("from", event.currentTarget.value)} /><TextInput type="date" label="To" value={to} onChange={(event) => setParam("to", event.currentTarget.value)} /><Select label="Group reports by" value={groupBy} onChange={(value) => setParam("groupBy", value ?? "month")} data={[{ value: "month", label: "Month" }, { value: "quarter", label: "Quarter" }, { value: "fiscal_year", label: "Indian fiscal year" }]} />{owner && <Select label="Report scope" value={consolidated ? "all" : "store"} onChange={(value) => setParam("scope", value === "store" ? "store" : undefined)} data={[{ value: "all", label: "All stores (consolidated)" }, { value: "store", label: activeStoreId ? "Selected store" : "Selected store (choose one first)", disabled: !activeStoreId }]} />}{exportTypes.length > 0 && reportStoreId !== undefined && <FinanceExportButtons reportTypes={exportTypes} storeId={reportStoreId} from={from} to={to} groupBy={groupBy} />}</Group>}
    {from > to && <Alert color="red" title="Invalid date range">The end date must be on or after the start date.</Alert>}
    <Tabs value={selectedTab} onChange={setTab} keepMounted={false}>
      <Tabs.List aria-label="Finance workspace sections">
        {canOverview && <Tabs.Tab value="overview" leftSection={<Landmark size={16} />}>Overview</Tabs.Tab>}
        {canOverview && <Tabs.Tab value="pnl" leftSection={<FileChartColumn size={16} />}>Profit & loss</Tabs.Tab>}
        {canSales && <Tabs.Tab value="sales-margin" leftSection={<ChartNoAxesCombined size={16} />}>Sales & margin</Tabs.Tab>}
        {canReadRefunds && <Tabs.Tab value="refunds" leftSection={<RotateCcw size={16} />}>Payments & refunds</Tabs.Tab>}
        {canReadExpenses && <Tabs.Tab value="expenses" leftSection={<ReceiptText size={16} />}>Expenses</Tabs.Tab>}
        {canReadSettlements && <Tabs.Tab value="settlements" leftSection={<Banknote size={16} />}>Settlements</Tabs.Tab>}
        {canManageCash && <Tabs.Tab value="cash" leftSection={<HandCoins size={16} />}>COD cash</Tabs.Tab>}
        {canReadLedger && <Tabs.Tab value="ledger" leftSection={<BookOpen size={16} />}>Ledger</Tabs.Tab>}
        {canReadLedger && <Tabs.Tab value="close" leftSection={<Calculator size={16} />}>Close</Tabs.Tab>}
        {canReadSettlements && <Tabs.Tab value="issues" leftSection={<FileSearch size={16} />}>Issues</Tabs.Tab>}
        {(canReadCosts || canReadExpenses) && <Tabs.Tab value="configuration" leftSection={<Tags size={16} />}>Configuration</Tabs.Tab>}
      </Tabs.List>
      {canOverview && <Tabs.Panel value="overview" pt="lg">{from <= to && <FinanceOverviewPanel {...reports} />}</Tabs.Panel>}
      {canOverview && <Tabs.Panel value="pnl" pt="lg">{from <= to && <FinanceProfitAndLossPanel {...reports} />}</Tabs.Panel>}
      {canSales && <Tabs.Panel value="sales-margin" pt="lg">{from <= to && <FinanceSalesMarginsPanel {...reports} />}</Tabs.Panel>}
      {canReadRefunds && <Tabs.Panel value="refunds" pt="lg"><div className="space-y-4">{canOverview && from <= to && <PaymentsSummary storeId={reportStoreId} from={from} to={to} onDrillDown={drillDown} />}{activeStoreId ? <RefundsPanel storeId={activeStoreId} canApprove={canApprove} /> : <Alert color="gray">Select a store to manage individual refunds.</Alert>}</div></Tabs.Panel>}
      {canReadExpenses && <Tabs.Panel value="expenses" pt="lg">{activeStoreId ? <ExpensesPanel storeId={activeStoreId} canCreate={canCreateExpenses} canApprove={canApproveExpenses} canPay={canPayExpenses} /> : <Alert color="gray">Select a store to manage expenses.</Alert>}</Tabs.Panel>}
      {canReadSettlements && <Tabs.Panel value="settlements" pt="lg">{activeStoreId ? <SettlementsPanel storeId={activeStoreId} canManage={canManage} /> : <Alert color="gray">Select a store to inspect settlements.</Alert>}</Tabs.Panel>}
      {canManageCash && <Tabs.Panel value="cash" pt="lg">{activeStoreId ? <CashSessionsPanel storeId={activeStoreId} canReview={canReviewCash} /> : <Alert color="gray">Select a store to manage COD cash.</Alert>}</Tabs.Panel>}
      {canReadLedger && <Tabs.Panel value="ledger" pt="lg">{drillFilters ? <JournalDrillDown storeId={consolidated ? null : activeStoreId} filters={drillFilters} onClear={clearDrill} /> : activeStoreId ? <LedgerPanel storeId={activeStoreId} canPost={canPostLedger} isOwner={owner} /> : <Alert color="gray">Select a store for its trial balance, or open a report aggregate for consolidated journal drill-down.</Alert>}</Tabs.Panel>}
      {canReadLedger && <Tabs.Panel value="close" pt="lg">{activeStoreId ? <PeriodClosePanel storeId={activeStoreId} isOwner={owner} /> : <Alert color="gray">Select one store to inspect or control fiscal periods.</Alert>}</Tabs.Panel>}
      {canReadSettlements && <Tabs.Panel value="issues" pt="lg"><IssuesPanel storeId={consolidated ? null : activeStoreId} canManage={canManage} /></Tabs.Panel>}
      {(canReadCosts || canReadExpenses) && <Tabs.Panel value="configuration" pt="lg"><div className="space-y-5">{activeStoreId && canReadExpenses && <VendorsPanel storeId={activeStoreId} canManage={canCreateExpenses} canManagePlatform={owner} />}{activeStoreId && canReadCosts && <CostsPanel storeId={activeStoreId} canManage={canManageCosts} />}{!activeStoreId && <Alert color="gray">Select a store to manage finance configuration.</Alert>}</div></Tabs.Panel>}
    </Tabs>
    {!availableTabs.length && <EmptyState icon={Banknote} title="No finance access" description="Your current role has no finance workspace permissions." />}
    <Text size="xs" c="dimmed">Management reporting only · not a statutory financial statement or tax filing.</Text>
  </div>;
};

export default FinanceWorkspacePage;
