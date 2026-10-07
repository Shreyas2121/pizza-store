import { useState } from "react";
import { Alert, Button, Group, NumberInput, Select, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { formatPaise, parseRupeesToPaise } from "@/shared/lib";
import { useExpenseCategories, useVendors } from "../api/finance.queries";
import { buildExpenseUpdate, expenseDraftFromDetail } from "../model/expense-draft";
import type { ExpenseDetail, ExpenseWritePayload } from "../model/finance.types";
import { apiMessage } from "../model/finance.helpers";

export function ExpenseDraftForm({ storeId, initial, saving, onSave, onCancel }: {
  storeId: number; initial?: ExpenseDetail; saving: boolean;
  onSave: (data: Omit<ExpenseWritePayload, "storeId">) => Promise<void>; onCancel: () => void;
}) {
  const vendors = useVendors(storeId); const categories = useExpenseCategories(storeId);
  const [draft, setDraft] = useState(() => expenseDraftFromDetail(storeId, initial));
  const [failure, setFailure] = useState<string | null>(null);
  const total = (() => { try { return parseRupeesToPaise(draft.subtotal) + parseRupeesToPaise(draft.tax); } catch { return null; } })();
  const allocated = (() => { try { return draft.allocations.reduce((sum, item) => sum + parseRupeesToPaise(item.amount), 0); } catch { return null; } })();
  const vendorOptions = (vendors.data ?? []).map((item) => ({ value: String(item.id), label: `${item.name}${item.isActive ? "" : " (inactive)"}`, disabled: !item.isActive }));
  if (draft.vendorId && !vendorOptions.some((item) => item.value === draft.vendorId)) vendorOptions.push({ value: draft.vendorId, label: initial?.expense.vendorName ?? `Vendor #${draft.vendorId}`, disabled: true });
  const updateAllocation = (index: number, patch: Partial<typeof draft.allocations[number]>) => setDraft((current) => ({ ...current, allocations: current.allocations.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  const submit = async () => {
    setFailure(null);
    try { await onSave(buildExpenseUpdate(draft)); }
    catch (cause) { setFailure(cause instanceof z.ZodError ? cause.issues.map((issue) => issue.message).join(" ") : cause instanceof Error && !('response' in cause) ? cause.message : apiMessage(cause)); }
  };
  return <form onSubmit={(event) => { event.preventDefault(); if (!saving) void submit(); }}><Stack>
    {(vendors.isError || categories.isError) && <Alert color="red">Vendors or categories could not be loaded.<Button size="xs" variant="subtle" onClick={() => { vendors.refetch(); categories.refetch(); }}>Retry</Button></Alert>}
    {initial?.expense.status === "rejected" && <Alert color="blue">Saving corrections returns this expense to draft. Submit it again for approval after reviewing the changes.</Alert>}
    <fieldset disabled={saving} className="space-y-4">
      <Group grow><Select searchable clearable label="Vendor" value={draft.vendorId} onChange={(vendorId) => setDraft((current) => ({ ...current, vendorId }))} data={vendorOptions} /><TextInput required type="date" label="Expense date" value={draft.date} onChange={(event) => { const date = event.currentTarget.value; setDraft((current) => ({ ...current, date })); }} /></Group>
      <Textarea required label="Description" maxLength={1000} value={draft.description} onChange={(event) => { const description = event.currentTarget.value; setDraft((current) => ({ ...current, description })); }} />
      <Group grow><NumberInput label="Subtotal (₹)" min={0} max={500000} decimalScale={2} value={draft.subtotal} onChange={(subtotal) => setDraft((current) => ({ ...current, subtotal }))} /><NumberInput label="Included tax (₹)" min={0} max={500000} decimalScale={2} value={draft.tax} onChange={(tax) => setDraft((current) => ({ ...current, tax }))} /><TextInput readOnly label="Inclusive total" value={total === null ? "Enter valid amounts" : formatPaise(total)} /></Group>
      <Group justify="space-between"><div><Text fw={700}>Exact allocations</Text><Text size="sm" c={allocated === total ? "green" : "red"}>{allocated === null ? "Enter valid allocations" : `${formatPaise(allocated)} allocated`} of {total === null ? "—" : formatPaise(total)}</Text></div><Button size="xs" variant="light" leftSection={<Plus size={14} />} disabled={draft.allocations.length >= 100} onClick={() => setDraft((current) => ({ ...current, allocations: [...current.allocations, { storeId, categoryId: null, costCenter: "", amount: 0 }] }))}>Split allocation</Button></Group>
      <Stack gap="sm">{draft.allocations.map((item, index) => {
        const categoryOptions = (categories.data ?? []).map((category) => ({ value: String(category.id), label: `${category.name}${category.isActive ? "" : " (inactive)"}`, disabled: !category.isActive }));
        if (item.categoryId && !categoryOptions.some((option) => option.value === item.categoryId)) categoryOptions.push({ value: item.categoryId, label: item.categoryName ?? `Category #${item.categoryId}`, disabled: false });
        return <div key={index} className="rounded-lg border border-border p-3">
          <Text size="xs" c="dimmed" mb="xs">Allocation {index + 1} · Store #{item.storeId}</Text>
          <Group grow align="end"><Select label="Category" value={item.categoryId} onChange={(categoryId) => updateAllocation(index, { categoryId })} data={categoryOptions} disabled={item.storeId !== storeId} /><TextInput label="Cost center" maxLength={120} value={item.costCenter} onChange={(event) => updateAllocation(index, { costCenter: event.currentTarget.value })} /><NumberInput label="Amount (₹)" min={0.01} max={500000} decimalScale={2} value={item.amount} onChange={(amount) => updateAllocation(index, { amount })} /><Button color="red" variant="subtle" aria-label={`Remove allocation ${index + 1}`} disabled={draft.allocations.length === 1} onClick={() => setDraft((current) => ({ ...current, allocations: current.allocations.filter((_, i) => i !== index) }))}><Trash2 size={16} /></Button></Group>
        </div>;
      })}</Stack>
      {draft.allocations.length === 1 && total !== null && total > 0 && <Button size="xs" variant="subtle" onClick={() => updateAllocation(0, { amount: total / 100 })}>Allocate full total</Button>}
    </fieldset>
    {failure && <Alert color="red" role="alert">{failure}</Alert>}
    <Group justify="end"><Button variant="default" onClick={onCancel} disabled={saving}>Cancel</Button><Button type="submit" loading={saving} disabled={vendors.isLoading || categories.isLoading || vendors.isError || categories.isError || total === null || total <= 0 || allocated !== total || !draft.description.trim()}>{initial ? "Save expense changes" : "Save draft expense"}</Button></Group>
  </Stack></form>;
}
