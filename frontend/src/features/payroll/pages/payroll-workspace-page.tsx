import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Badge, Button, Card, Group, Loader, Modal, Stack, Table, Tabs, Text, TextInput, Textarea } from "@mantine/core";
import { Banknote, Download, FileText, Users } from "lucide-react";
import { hasStorePermission, useAccessMe, useStaffActiveStore } from "@/features/access";
import { error, formatDate, formatPaise, success } from "@/shared/lib";
import { EmptyState, PageHeader } from "@/shared/ui";
import { useCreatePayRun, useDownloadPayRun, usePayRun, usePayRunCommand, usePayRuns, usePayStatement } from "../api/payroll.queries";
import { PayrollProfilesPanel } from "../components/payroll-profiles-panel";
import type { PayRun, PayRunStatus } from "../model/payroll.types";

type Command = "calculate" | "approve" | "pay" | "post" | "void" | "reverse";
const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase());
const message = (cause: unknown) => axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message ?? "Payroll action failed." : "Payroll action failed.";
const monthRange = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return { periodStart: `${month}-01`, periodEnd: `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, "0")}` };
};
const nextByStatus: Record<PayRunStatus, Command | null> = { draft: "calculate", calculated: "approve", approved: "pay", paid: "post", posted: "reverse", voided: null, reversed: null };
const nextCommand = (status: PayRunStatus): Command | null => nextByStatus[status];

export const PayrollWorkspacePage = () => {
  const { activeStoreId } = useStaffActiveStore();
  const { data: access } = useAccessMe();
  const runs = usePayRuns(activeStoreId);
  const [runId, setRunId] = useState<number | null>(null);
  const [statementEmployeeId, setStatementEmployeeId] = useState<number | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [action, setAction] = useState<{ run: PayRun; command: Command } | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const detail = usePayRun(runId);
  const statement = usePayStatement(runId, statementEmployeeId);
  const create = useCreatePayRun();
  const command = usePayRunCommand();
  const download = useDownloadPayRun();
  const canManage = hasStorePermission(access, activeStoreId, "payroll.manage");
  const permissions = useMemo(() => ({
    calculate: hasStorePermission(access, activeStoreId, "payroll.calculate"),
    approve: hasStorePermission(access, activeStoreId, "payroll.approve"),
    pay: hasStorePermission(access, activeStoreId, "payroll.pay"),
    post: hasStorePermission(access, activeStoreId, "payroll.pay"),
    void: canManage,
    reverse: hasStorePermission(access, activeStoreId, "payroll.pay"),
  }), [access, activeStoreId, canManage]);

  useEffect(() => {
    setRunId(null);
    setStatementEmployeeId(null);
    setAction(null);
  }, [activeStoreId]);

  const execute = async () => {
    if (!action) return;
    const data = action.command === "pay" ? { paymentReference }
      : action.command === "reverse" ? { reason, effectiveBusinessDate: effectiveDate }
        : action.command === "void" ? { reason } : {};
    try {
      await command.mutateAsync({ payRunId: action.run.id, action: action.command, data });
      success(`${label(action.command)} completed.`);
      setRunId(action.run.id); setAction(null); setPaymentReference(""); setReason("");
    } catch (cause) { error(message(cause)); }
  };
  const openAction = (run: PayRun, requested?: Command) => {
    const selected = requested ?? nextCommand(run.status);
    if (selected) { setReason(""); setPaymentReference(""); setAction({ run, command: selected }); }
  };

  if (!activeStoreId) return <><PageHeader eyebrow="Restricted payroll" title="Payroll workspace" description="Select one store to manage its demo payroll." /><EmptyState icon={Banknote} title="Choose a store" description="Payroll data is strictly store-scoped." /></>;
  return <div className="space-y-5">
    <PageHeader eyebrow="Restricted operating cost" title="Payroll workspace" description="Effective compensation, monthly pay runs, gross-to-net evidence, and ledger posting." />
    <Alert color="yellow" title="Portfolio demo only">Not statutory payroll, tax, TDS, EPF, ESI, filing, or employment advice. Values are configured examples in exact INR.</Alert>
    <Tabs defaultValue="runs" keepMounted={false}>
      <Tabs.List><Tabs.Tab value="runs" leftSection={<Banknote size={16} />}>Pay runs</Tabs.Tab><Tabs.Tab value="profiles" leftSection={<Users size={16} />}>Employee profiles</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="runs" pt="lg"><Stack>
        {canManage && <Card withBorder><Group align="end"><TextInput type="month" label="Calendar month" value={month} onChange={(event) => setMonth(event.currentTarget.value)} /><Button loading={create.isPending} onClick={async () => { try { const range = monthRange(month); await create.mutateAsync({ storeId: activeStoreId, ...range }); success("Draft pay run created."); } catch (cause) { error(message(cause)); } }}>Create draft</Button></Group></Card>}
        {runs.isLoading ? <Loader /> : runs.isError ? <Alert color="red">Pay runs could not be loaded.</Alert> : !runs.data?.data.length ? <EmptyState icon={Banknote} title="No pay runs" description="Create a calendar-month draft to begin." /> : <Card withBorder><div className="overflow-x-auto"><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Period</Table.Th><Table.Th>Status</Table.Th><Table.Th>Employees</Table.Th><Table.Th>Gross</Table.Th><Table.Th>Net</Table.Th><Table.Th>Employer cost</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{runs.data.data.map((run) => { const next = nextCommand(run.status); return <Table.Tr key={run.id}><Table.Td>{formatDate(run.periodStart)} – {formatDate(run.periodEnd)}</Table.Td><Table.Td><Badge color={["posted", "paid", "approved"].includes(run.status) ? "green" : ["voided", "reversed"].includes(run.status) ? "red" : "blue"}>{label(run.status)}</Badge></Table.Td><Table.Td>{run.employeeCount ?? "—"}</Table.Td><Table.Td>{run.grossPayPaise == null ? "—" : formatPaise(run.grossPayPaise)}</Table.Td><Table.Td>{run.netPayPaise == null ? "—" : formatPaise(run.netPayPaise)}</Table.Td><Table.Td>{run.totalEmployerCostPaise == null ? "—" : formatPaise(run.totalEmployerCostPaise)}</Table.Td><Table.Td><Group gap="xs"><Button size="compact-xs" variant="subtle" onClick={() => setRunId(run.id)}>Open</Button>{next && permissions[next] && <Button size="compact-xs" onClick={() => openAction(run)}>{label(next)}</Button>}{["draft", "calculated", "approved"].includes(run.status) && permissions.void && <Button size="compact-xs" color="red" variant="light" onClick={() => openAction(run, "void")}>Void</Button>}</Group></Table.Td></Table.Tr>; })}</Table.Tbody></Table></div></Card>}
      </Stack></Tabs.Panel>
      <Tabs.Panel value="profiles" pt="lg"><PayrollProfilesPanel key={activeStoreId} storeId={activeStoreId} canManage={canManage} /></Tabs.Panel>
    </Tabs>

    <Modal opened={Boolean(runId)} onClose={() => { setRunId(null); setStatementEmployeeId(null); }} title={`Pay run #${runId ?? ""}`} size="xl">{detail.isLoading ? <Loader /> : detail.isError ? <Alert color="red">Pay-run detail could not be loaded.</Alert> : detail.data && <Stack><Group justify="space-between"><div><Badge>{label(detail.data.data.run.status)}</Badge><Text size="sm" c="dimmed" mt="xs">{detail.data.data.run.periodStart} to {detail.data.data.run.periodEnd}</Text></div><Button variant="light" leftSection={<Download size={15} />} loading={download.isPending} onClick={async () => { try { await download.mutateAsync(detail.data!.data.run.id); } catch (cause) { error(message(cause)); } }}>CSV snapshot</Button></Group><div className="grid gap-3 sm:grid-cols-4">{[["Gross", detail.data.data.run.grossPayPaise], ["Deductions", detail.data.data.run.deductionPaise], ["Net", detail.data.data.run.netPayPaise], ["Employer cost", detail.data.data.run.totalEmployerCostPaise]].map(([name, amount]) => <Card key={String(name)} withBorder><Text size="xs" c="dimmed">{name}</Text><Text fw={800}>{amount == null ? "—" : formatPaise(Number(amount))}</Text></Card>)}</div><Table withTableBorder><Table.Thead><Table.Tr><Table.Th>Employee</Table.Th><Table.Th>Gross</Table.Th><Table.Th>Deductions</Table.Th><Table.Th>Net</Table.Th><Table.Th>Statement</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{detail.data.data.employees.map((employee) => <Table.Tr key={employee.id}><Table.Td>{employee.employeeCode} · {employee.displayName}</Table.Td><Table.Td>{formatPaise(employee.grossPayPaise)}</Table.Td><Table.Td>{formatPaise(employee.deductionPaise)}</Table.Td><Table.Td>{formatPaise(employee.netPayPaise)}</Table.Td><Table.Td><Button size="compact-xs" variant="subtle" leftSection={<FileText size={14} />} onClick={() => setStatementEmployeeId(employee.id)}>Open</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table></Stack>}</Modal>

    <Modal opened={Boolean(statementEmployeeId)} onClose={() => setStatementEmployeeId(null)} title="Demo pay statement" size="lg">{statement.isLoading ? <Loader /> : statement.isError ? <Alert color="red">Statement could not be loaded.</Alert> : statement.data && <Stack><Alert color="yellow">Demo payslip-style evidence only. Not a statutory payslip or filing document.</Alert><div><Text fw={800}>{statement.data.data.employee.displayName}</Text><Text size="sm" c="dimmed">{statement.data.data.employee.employeeCode} · {statement.data.data.payRun.periodStart} to {statement.data.data.payRun.periodEnd}</Text></div><Table withTableBorder><Table.Thead><Table.Tr><Table.Th>Component</Table.Th><Table.Th>Type</Table.Th><Table.Th>Amount</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{statement.data.data.lines.map((line) => <Table.Tr key={`${line.type}-${line.componentCode}`}><Table.Td>{line.componentName}</Table.Td><Table.Td>{label(line.type)}</Table.Td><Table.Td>{formatPaise(line.amountPaise)}</Table.Td></Table.Tr>)}</Table.Tbody></Table><Group justify="space-between"><Text>Gross <b>{formatPaise(statement.data.data.totals.grossPayPaise)}</b></Text><Text>Deductions <b>{formatPaise(statement.data.data.totals.deductionPaise)}</b></Text><Text>Net <b>{formatPaise(statement.data.data.totals.netPayPaise)}</b></Text></Group></Stack>}</Modal>

    <Modal opened={Boolean(action)} onClose={() => setAction(null)} title={action ? `${label(action.command)} pay run #${action.run.id}` : "Payroll action"} centered><Stack><Alert color={["void", "reverse"].includes(action?.command ?? "") ? "red" : "yellow"}>This is an audited, idempotent payroll action and requires recent authentication. Calculate, approve, and pay must be performed by separate people.</Alert>{action?.command === "pay" && <TextInput required label="Payment reference" value={paymentReference} onChange={(event) => setPaymentReference(event.currentTarget.value)} />}{["void", "reverse"].includes(action?.command ?? "") && <Textarea required label="Reason" value={reason} onChange={(event) => setReason(event.currentTarget.value)} />}{action?.command === "reverse" && <TextInput type="date" required label="Reversal business date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.currentTarget.value)} />}<Button color={["void", "reverse"].includes(action?.command ?? "") ? "red" : "brand"} loading={command.isPending} disabled={(action?.command === "pay" && paymentReference.trim().length < 3) || (["void", "reverse"].includes(action?.command ?? "") && reason.trim().length < 3)} onClick={execute}>Confirm {action ? label(action.command) : "action"}</Button></Stack></Modal>
  </div>;
};

export default PayrollWorkspacePage;
