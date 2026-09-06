import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Drawer, FileInput, Group, Loader, Modal, NumberInput, Select, Stack, Table, Text, TextInput, Textarea } from "@mantine/core";
import { Download, Plus, ReceiptText, Trash2, Upload } from "lucide-react";
import { formatDate, formatPaise } from "@/shared/lib";
import { error, success } from "@/shared/lib/notifications";
import { EmptyState } from "@/shared/ui";
import type { Expense, ExpenseStatus } from "../model/finance.types";
import { apiMessage, humanizeStatus } from "../model/finance.helpers";
import { useCreateExpense, useDownloadExpenseReceipt, useExpense, useExpenseAttachments, useExpenseCategories, useExpenseCommand, useExpenses, useSourceMargin, useUploadExpenseReceipt, useVendors } from "../api/finance.queries";
import { StatusBadge } from "./status-badge";

type AllocationDraft = { categoryId: string | null; costCenter: string; amountPaise: string | number };
const today = () => new Date().toISOString().slice(0, 10);
const integer = (value: string | number) => typeof value === "number" && Number.isInteger(value) ? value : 0;

const SourceMarginCard = ({ storeId }: { storeId: number }) => {
  const margin = useSourceMargin(storeId);
  if (margin.isLoading) return <Loader size="sm" aria-label="Loading source margin" />;
  if (margin.isError || !margin.data) return <Alert color="red">The source-based margin view could not be loaded.</Alert>;
  const data = margin.data;
  return <Card withBorder>
    <Group justify="space-between" align="start"><div><Text fw={800}>Source-based operating view</Text><Text size="sm" c="dimmed">Pre-ledger · delivered order snapshots and paid/posted expense sources</Text></div><StatusBadge value={data.costCoverageComplete ? "costs complete" : "cost gaps"} /></Group>
    {!data.costCoverageComplete && <Alert mt="sm" color="yellow">Only {data.costedOrderLines} of {data.totalOrderLines} delivered order lines have cost snapshots. Margin is incomplete.</Alert>}
    <div className="mt-4 grid gap-3 sm:grid-cols-5">{[["Delivered sales", data.deliveredSalesPaise], ["Standard COGS", data.cogsPaise], ["Gross profit", data.grossProfitPaise], ["Operating expenses", data.operatingExpensesPaise], ["Operating result", data.operatingResultPaise]].map(([label, value]) => <div key={String(label)}><Text size="xs" c="dimmed">{label}</Text><Text fw={800} className="tabular-nums">{formatPaise(Number(value))}</Text></div>)}</div>
    <Text mt="sm" size="sm">Gross margin: {data.grossMarginBps === null ? "—" : `${(data.grossMarginBps / 100).toFixed(2)}%`}</Text>
  </Card>;
};

const ExpenseCreateModal = ({ opened, onClose, storeId }: { opened: boolean; onClose: () => void; storeId: number }) => {
  const vendors = useVendors(storeId); const categories = useExpenseCategories(storeId); const create = useCreateExpense();
  const [vendorId, setVendorId] = useState<string | null>(null); const [date, setDate] = useState(today()); const [description, setDescription] = useState("");
  const [subtotal, setSubtotal] = useState<string | number>(0); const [tax, setTax] = useState<string | number>(0);
  const [allocations, setAllocations] = useState<AllocationDraft[]>([{ categoryId: null, costCenter: "", amountPaise: 0 }]);
  const total = integer(subtotal) + integer(tax); const allocated = allocations.reduce((sum, item) => sum + integer(item.amountPaise), 0);
  useEffect(() => { if (allocations.length === 1) setAllocations((items) => [{ ...items[0], amountPaise: total }]); }, [total, allocations.length]);
  const updateAllocation = (index: number, patch: Partial<AllocationDraft>) => setAllocations((items) => items.map((item, position) => position === index ? { ...item, ...patch } : item));
  const submit = async () => {
    try {
      await create.mutateAsync({ idempotencyKey: crypto.randomUUID(), data: { storeId, vendorId: vendorId ? Number(vendorId) : null, expenseDate: date, description: description.trim(), subtotalPaise: integer(subtotal), taxPaise: integer(tax), totalPaise: total, allocations: allocations.map((item) => ({ storeId, categoryId: Number(item.categoryId), costCenter: item.costCenter.trim() || null, amountPaise: integer(item.amountPaise) })) } });
      success("Draft expense created with exact allocations."); onClose(); setDescription(""); setSubtotal(0); setTax(0); setAllocations([{ categoryId: null, costCenter: "", amountPaise: 0 }]);
    } catch (cause) { error(apiMessage(cause)); }
  };
  const valid = Boolean(date && description.trim() && total > 0 && total === allocated && allocations.every((item) => item.categoryId && integer(item.amountPaise) > 0));
  return <Modal opened={opened} onClose={onClose} title="Create draft expense" size="xl" centered>
    <Stack><Group grow><Select searchable clearable label="Vendor" value={vendorId} onChange={setVendorId} data={(vendors.data ?? []).filter((item) => item.isActive).map((item) => ({ value: String(item.id), label: item.name }))} /><TextInput type="date" label="Expense date" value={date} onChange={(event) => setDate(event.currentTarget.value)} /></Group>
      <Textarea label="Description" required value={description} onChange={(event) => setDescription(event.currentTarget.value)} maxLength={1000} />
      <Group grow><NumberInput label="Subtotal (paise)" min={0} allowDecimal={false} value={subtotal} onChange={setSubtotal} /><NumberInput label="Included tax (paise)" min={0} allowDecimal={false} value={tax} onChange={setTax} /><TextInput label="Inclusive total" readOnly value={formatPaise(total)} /></Group>
      <div><Group justify="space-between"><div><Text fw={700}>Exact allocations</Text><Text size="xs" c={allocated === total ? "green" : "red"}>{formatPaise(allocated)} allocated of {formatPaise(total)}</Text></div><Button size="xs" variant="light" leftSection={<Plus size={14} />} onClick={() => setAllocations((items) => [...items, { categoryId: null, costCenter: "", amountPaise: 0 }])}>Split allocation</Button></Group>
        <Stack mt="sm" gap="xs">{allocations.map((item, index) => <Group key={index} grow align="end"><Select label="Category" value={item.categoryId} onChange={(value) => updateAllocation(index, { categoryId: value })} data={(categories.data ?? []).filter((category) => category.isActive).map((category) => ({ value: String(category.id), label: `${category.name}${category.ledgerAccountId ? "" : " · unmapped"}` }))} /><TextInput label="Cost center" value={item.costCenter} onChange={(event) => updateAllocation(index, { costCenter: event.currentTarget.value })} /><NumberInput label="Amount (paise)" min={1} allowDecimal={false} value={item.amountPaise} onChange={(value) => updateAllocation(index, { amountPaise: value })} /><Button color="red" variant="subtle" aria-label="Remove allocation" disabled={allocations.length === 1} onClick={() => setAllocations((items) => items.filter((_, position) => position !== index))}><Trash2 size={16} /></Button></Group>)}</Stack>
      </div>
      <Button loading={create.isPending} disabled={!valid} onClick={submit}>Save draft expense</Button>
    </Stack>
  </Modal>;
};

const ExpenseDetailDrawer = ({ expense, onClose, canCreate, canApprove, canPay }: { expense: Expense | null; onClose: () => void; canCreate: boolean; canApprove: boolean; canPay: boolean }) => {
  const detail = useExpense(expense?.id ?? null); const attachments = useExpenseAttachments(expense?.id ?? null); const command = useExpenseCommand(); const upload = useUploadExpenseReceipt(); const download = useDownloadExpenseReceipt();
  const [reason, setReason] = useState(""); const [paymentMethod, setPaymentMethod] = useState<string | null>("bank_transfer"); const [reference, setReference] = useState(""); const [overrideReason, setOverrideReason] = useState(""); const [file, setFile] = useState<File | null>(null);
  const current = detail.data?.expense;
  const detailAllocations = detail.data?.allocations ?? [];
  const act = async (action: "submit" | "approve" | "reject" | "pay" | "post" | "void" | "reverse", data?: Record<string, unknown>) => { if (!current) return; try { await command.mutateAsync({ expenseId: current.id, action, data }); success(`Expense ${action} completed.`); setReason(""); } catch (cause) { error(apiMessage(cause)); } };
  return <Drawer opened={Boolean(expense)} onClose={onClose} position="right" size="xl" title={`Expense #${expense?.id ?? ""}`}>
    {detail.isLoading ? <Loader /> : detail.isError || !current ? <Alert color="red">Expense detail could not be loaded.</Alert> : <Stack>
      <Card withBorder><Group justify="space-between"><div><Text fw={800}>{current.description}</Text><Text size="sm" c="dimmed">{formatDate(current.expenseDate)} · {current.vendorName ?? "No vendor"}</Text></div><div className="text-right"><StatusBadge value={current.status} /><Text fw={800} mt="xs">{formatPaise(current.totalPaise)}</Text></div></Group></Card>
      <Card withBorder><Text fw={700}>Allocation evidence</Text><Table mt="sm"><Table.Thead><Table.Tr><Table.Th>Store</Table.Th><Table.Th>Category</Table.Th><Table.Th>Cost center</Table.Th><Table.Th>Account</Table.Th><Table.Th>Amount</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{detailAllocations.map((item) => <Table.Tr key={item.id}><Table.Td>#{item.storeId}</Table.Td><Table.Td>{item.categoryName}</Table.Td><Table.Td>{item.costCenter ?? "—"}</Table.Td><Table.Td>{item.ledgerAccountId ?? "Unmapped"}</Table.Td><Table.Td>{formatPaise(item.amountPaise)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Card>
      <Card withBorder><Text fw={700}>Private receipts</Text><Text size="xs" c="dimmed">PDF, JPEG, PNG, or WebP · maximum 5 MiB · authenticated download only</Text>{attachments.isLoading ? <Loader mt="sm" size="sm" /> : !attachments.data?.length ? <Text mt="sm" size="sm" c="dimmed">No receipt attached.</Text> : attachments.data.map((item) => <Group mt="sm" key={item.id} justify="space-between"><div><Text size="sm">{item.originalName}</Text><Text size="xs" c="dimmed">{Math.ceil(item.sizeBytes / 1024)} KiB · uploaded by user #{item.uploadedBy}</Text></div><Button size="compact-sm" variant="subtle" leftSection={<Download size={14} />} loading={download.isPending} onClick={() => download.mutate({ expenseId: current.id, attachment: item })}>Download</Button></Group>)}{canCreate && ["draft", "rejected"].includes(current.status) && <Group mt="sm" align="end"><FileInput flex={1} label="Add receipt" accept="application/pdf,image/jpeg,image/png,image/webp" value={file} onChange={setFile} /><Button leftSection={<Upload size={14} />} disabled={!file} loading={upload.isPending} onClick={async () => { if (!file) return; try { await upload.mutateAsync({ expenseId: current.id, file }); success("Receipt stored privately."); setFile(null); } catch (cause) { error(apiMessage(cause)); } }}>Upload</Button></Group>}</Card>
      <Card withBorder><Text fw={700}>Workflow actions</Text><Group mt="sm">
        {canCreate && current.status === "draft" && <Button onClick={() => act("submit")}>Submit for approval</Button>}
        {canApprove && current.status === "submitted" && <Button color="green" onClick={() => act("approve")}>Approve</Button>}
        {canPay && current.status === "paid" && <Button onClick={() => act("post")}>Post source event</Button>}
      </Group>
      {canPay && current.status === "approved" && <Stack mt="sm"><Group grow><Select label="Payment method" value={paymentMethod} onChange={setPaymentMethod} data={["bank_transfer", "cash", "card", "upi", "other"].map((value) => ({ value, label: humanizeStatus(value) }))} /><TextInput label="Payment reference" value={reference} onChange={(event) => setReference(event.currentTarget.value)} /></Group><Textarea label="Platform-admin segregation override reason (only when required)" value={overrideReason} onChange={(event) => setOverrideReason(event.currentTarget.value)} /><Button disabled={!paymentMethod} onClick={() => act("pay", { paymentMethod, paymentReference: reference.trim() || null, segregationOverrideReason: overrideReason.trim() || undefined })}>Record payment</Button></Stack>}
      {((canApprove && ["draft", "submitted", "approved", "paid", "rejected"].includes(current.status)) || (canPay && current.status === "posted")) && <Stack mt="sm"><Textarea label={current.status === "submitted" ? "Rejection / void reason" : "Correction reason"} value={reason} onChange={(event) => setReason(event.currentTarget.value)} minLength={3} /><TextInput label={current.status === "paid" ? "Payment reversal reference (required)" : "Reference (optional)"} value={reference} onChange={(event) => setReference(event.currentTarget.value)} />
        <Group>{canApprove && current.status === "submitted" && <Button color="red" variant="outline" disabled={reason.trim().length < 3} onClick={() => act("reject", { reason: reason.trim() })}>Reject</Button>}{canApprove && ["draft", "submitted", "approved", "paid", "rejected"].includes(current.status) && <Button color="red" disabled={reason.trim().length < 3 || (current.status === "paid" && !reference.trim())} onClick={() => act("void", { reason: reason.trim(), paymentReversed: current.status === "paid" ? true : undefined, reversalReference: current.status === "paid" ? reference.trim() : undefined })}>Void expense</Button>}{canPay && current.status === "posted" && <Button color="red" disabled={reason.trim().length < 3} onClick={() => act("reverse", { reason: reason.trim() })}>Reverse posting</Button>}</Group>
      </Stack>}</Card>
    </Stack>}
  </Drawer>;
};

export const ExpensesPanel = ({ storeId, canCreate, canApprove, canPay }: { storeId: number; canCreate: boolean; canApprove: boolean; canPay: boolean }) => {
  const [status, setStatus] = useState<ExpenseStatus | undefined>(); const [createOpened, setCreateOpened] = useState(false); const [selected, setSelected] = useState<Expense | null>(null);
  const expenses = useExpenses(storeId, status);
  const statusOptions = useMemo(() => ["draft", "submitted", "approved", "paid", "posted", "rejected", "voided", "reversed"].map((value) => ({ value, label: humanizeStatus(value) })), []);
  return <Stack><SourceMarginCard storeId={storeId} /><Group justify="space-between"><Select clearable label="Filter by status" placeholder="All states" value={status ?? null} onChange={(value) => setStatus((value as ExpenseStatus) || undefined)} data={statusOptions} />{canCreate && <Button leftSection={<Plus size={16} />} onClick={() => setCreateOpened(true)}>New expense</Button>}</Group>
    {expenses.isLoading ? <Loader aria-label="Loading expenses" /> : expenses.isError ? <Alert color="red">Expenses could not be loaded.</Alert> : !expenses.data?.data.length ? <EmptyState icon={ReceiptText} title="No expenses" description="Create a draft with exact category and cost-center allocations." /> : <Card withBorder><div className="overflow-x-auto"><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Description</Table.Th><Table.Th>Vendor</Table.Th><Table.Th>Total</Table.Th><Table.Th>Status</Table.Th><Table.Th>Detail</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{expenses.data.data.map((item) => <Table.Tr key={item.id}><Table.Td>{formatDate(item.expenseDate)}</Table.Td><Table.Td>{item.description}</Table.Td><Table.Td>{item.vendorName ?? "—"}</Table.Td><Table.Td className="tabular-nums">{formatPaise(item.totalPaise)}</Table.Td><Table.Td><StatusBadge value={item.status} /></Table.Td><Table.Td><Button size="compact-sm" variant="subtle" onClick={() => setSelected(item)}>Open</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table></div></Card>}
    <ExpenseCreateModal opened={createOpened} onClose={() => setCreateOpened(false)} storeId={storeId} />
    <ExpenseDetailDrawer expense={selected} onClose={() => setSelected(null)} canCreate={canCreate} canApprove={canApprove} canPay={canPay} />
  </Stack>;
};
