import { PanelSkeleton } from "@/shared/ui";
import { useState } from "react";
import axios from "axios";
import { z } from "zod";
import { Alert, Button, Card, Group, Modal, NumberInput, Pagination, Select, Stack, Table, Text, TextInput, Textarea } from "@mantine/core";
import { useCompensationHistory, useCreateCompensation, useCreatePayrollProfile, usePayrollProfile, usePayrollProfiles, useUpdatePayrollProfile } from "../api/payroll.queries";
import { buildCompensationWrite, buildProfileWrite, type CompensationDraft, type SensitiveChange } from "../model/payroll.forms";
import type { PayrollProfile, PayrollProfileWrite } from "../model/payroll.types";
import { formatPaise, success } from "@/shared/lib";

const failure = (cause: unknown) => cause instanceof z.ZodError ? cause.issues.map((issue) => issue.message).join(" ") : axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message ?? "Payroll action failed." : cause instanceof Error ? cause.message : "Payroll action failed.";
const today = () => new Date().toISOString().slice(0, 10);

export function PayrollProfileForm({ profile, storeId, onSaved }: { profile?: PayrollProfile; storeId: number; onSaved: (id: number) => void }) {
  const [fields, setFields] = useState<Omit<PayrollProfileWrite, "bankAccountNumber" | "taxIdentifier">>({ userId: profile?.userId ?? null, employeeCode: profile?.employeeCode ?? "", displayName: profile?.displayName ?? "", employmentStartDate: profile?.employmentStartDate ?? today(), employmentEndDate: profile?.employmentEndDate ?? null, status: profile?.status ?? "active", payFrequency: "monthly" });
  const [bank, setBank] = useState<SensitiveChange>({ mode: "keep", value: "" });
  const [tax, setTax] = useState<SensitiveChange>({ mode: "keep", value: "" });
  const [message, setMessage] = useState<string | null>(null);
  const create = useCreatePayrollProfile(); const update = useUpdatePayrollProfile();
  const field = <K extends keyof typeof fields>(key: K, value: typeof fields[K]) => setFields((current) => ({ ...current, [key]: value }));
  return <form onSubmit={async (event) => { event.preventDefault(); setMessage(null); try { const data = buildProfileWrite(fields, bank, tax); const result = profile ? await update.mutateAsync({ profileId: profile.id, data }) : await create.mutateAsync({ ...data, storeId }); success("Payroll profile saved."); onSaved(result.data.id); } catch (cause) { setMessage(failure(cause)); } }}><Stack>
    {message && <Alert color="red">{message}</Alert>}
    <TextInput required label="Employee code" value={fields.employeeCode} onChange={(event) => field("employeeCode", event.currentTarget.value)} />
    <TextInput required label="Employee name" value={fields.displayName} onChange={(event) => field("displayName", event.currentTarget.value)} />
    <NumberInput label="Linked user ID (optional)" description="Use an existing user ID, or leave blank for an unlinked employee." min={1} allowDecimal={false} value={fields.userId ?? ""} onChange={(value) => field("userId", value === "" ? null : Number(value))} />
    <TextInput required type="date" label="Employment start date" value={fields.employmentStartDate} onChange={(event) => field("employmentStartDate", event.currentTarget.value)} />
    <TextInput type="date" label="Employment end date" value={fields.employmentEndDate ?? ""} onChange={(event) => field("employmentEndDate", event.currentTarget.value || null)} />
    <Select required label="Employment status" value={fields.status} data={[{ value: "active", label: "Active" }, { value: "on_leave", label: "On leave" }, { value: "terminated", label: "Terminated" }]} onChange={(value) => { if (value) field("status", value as typeof fields.status); }} />
    <Text size="sm">Pay frequency: Monthly</Text>
    {([{ title: "Bank account", masked: profile?.bankAccountMasked, change: bank, set: setBank }, { title: "Tax identifier", masked: profile?.taxIdentifierMasked, change: tax, set: setTax }]).map(({ title, masked, change, set }) => <Stack key={title} gap="xs"><Select label={title} description={profile ? `Current: ${masked ?? "Not set"}. Existing values are preserved unless changed.` : "Optional"} value={change.mode} data={[{ value: "keep", label: profile ? "Keep existing" : "Leave unset" }, { value: "replace", label: "Enter new value" }, { value: "clear", label: "Clear value" }]} onChange={(value) => set({ mode: value as SensitiveChange["mode"], value: "" })} />{change.mode === "replace" && <TextInput required autoComplete="off" label={`New ${title.toLowerCase()}`} value={change.value} onChange={(event) => set({ ...change, value: event.currentTarget.value })} />}</Stack>)}
    <Button type="submit" loading={create.isPending || update.isPending}>Save profile</Button>
  </Stack></form>;
}

export function CompensationForm({ profileId, onSaved }: { profileId: number; onSaved: () => void }) {
  const [draft, setDraft] = useState<CompensationDraft>({ effectiveFrom: today(), effectiveTo: "", sourceNote: "", components: [{ type: "earning", code: "BASIC", name: "Basic pay", amount: "" }] });
  const [message, setMessage] = useState<string | null>(null); const create = useCreateCompensation();
  const component = (index: number, patch: Partial<CompensationDraft["components"][number]>) => setDraft((current) => ({ ...current, components: current.components.map((row, i) => i === index ? { ...row, ...patch } : row) }));
  return <form onSubmit={async (event) => { event.preventDefault(); setMessage(null); try { await create.mutateAsync({ profileId, data: buildCompensationWrite(draft) }); success("Compensation version created."); onSaved(); } catch (cause) { setMessage(failure(cause)); } }}><Stack>
    <Alert>Dates must not overlap an existing compensation version. An open-ended version covers all later dates.</Alert>
    {message && <Alert color="red">{message}</Alert>}
    <TextInput required type="date" label="Effective from" value={draft.effectiveFrom} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, effectiveFrom: value })); }} />
    <TextInput type="date" label="Effective to (optional)" value={draft.effectiveTo} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, effectiveTo: value })); }} />
    <Textarea label="Source note" maxLength={500} value={draft.sourceNote} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, sourceNote: value })); }} />
    {draft.components.map((row, index) => <Card withBorder key={index}><Stack gap="xs"><Select label="Component type" value={row.type} data={[{ value: "earning", label: "Earning" }, { value: "deduction", label: "Deduction" }, { value: "employer_cost", label: "Employer cost" }]} onChange={(value) => { if (value) component(index, { type: value as typeof row.type }); }} /><TextInput required label="Code" value={row.code} onChange={(event) => component(index, { code: event.currentTarget.value })} /><TextInput required label="Name" value={row.name} onChange={(event) => component(index, { name: event.currentTarget.value })} /><TextInput required label="Monthly amount (INR)" inputMode="decimal" value={row.amount} onChange={(event) => component(index, { amount: event.currentTarget.value })} /><Button variant="subtle" color="red" disabled={draft.components.length === 1} onClick={() => setDraft((current) => ({ ...current, components: current.components.filter((_, i) => i !== index) }))}>Remove component</Button></Stack></Card>)}
    <Button variant="light" disabled={draft.components.length >= 50} onClick={() => setDraft((current) => ({ ...current, components: [...current.components, { type: "earning", code: "", name: "", amount: "" }] }))}>Add component</Button>
    <Button type="submit" loading={create.isPending}>Create compensation version</Button>
  </Stack></form>;
}

export function PayrollProfilesPanel({ storeId, canManage }: { storeId: number; canManage: boolean }) {
  const [page, setPage] = useState(1); const [profileId, setProfileId] = useState<number | null>(null); const [modal, setModal] = useState<"create" | "edit" | "compensation" | null>(null);
  const profiles = usePayrollProfiles(storeId, page); const detail = usePayrollProfile(profileId); const history = useCompensationHistory(profileId);
  const profile = detail.data?.data.storeId === storeId ? detail.data.data : undefined;
  return <Stack>
    {canManage && <Group><Button onClick={() => setModal("create")}>Create payroll profile</Button></Group>}
    {profiles.isLoading ? <PanelSkeleton form rows={1} label="Loading employee profiles" /> : profiles.isError ? <Alert color="red">Employee profiles could not be loaded. <Button variant="subtle" onClick={() => profiles.refetch()}>Retry</Button></Alert> : <><Select searchable clearable label="Employee finance profile" placeholder={profiles.data?.data.length ? "Select an employee" : "No employee profiles"} value={profileId?.toString() ?? null} onChange={(value) => setProfileId(value ? Number(value) : null)} data={(profiles.data?.data ?? []).map((item) => ({ value: String(item.id), label: `${item.employeeCode} · ${item.displayName}` }))} />{(profiles.data?.meta.totalPages ?? 0) > 1 && <Pagination value={page} total={profiles.data!.meta.totalPages} onChange={(value) => { setPage(value); setProfileId(null); }} />}</>}
    {profileId && (detail.isLoading ? <PanelSkeleton label="Loading employee profile" /> : detail.isError ? <Alert color="red">Profile details could not be loaded. <Button variant="subtle" onClick={() => detail.refetch()}>Retry</Button></Alert> : profile && <Card withBorder><Stack gap="xs"><Text fw={700}>{profile.displayName} · {profile.employeeCode}</Text><Text size="sm">{profile.status.replace("_", " ")} · Monthly · {profile.employmentStartDate} to {profile.employmentEndDate ?? "ongoing"}</Text><Text size="sm">Bank account: {profile.bankAccountMasked ?? "Not set"}</Text><Text size="sm">Tax identifier: {profile.taxIdentifierMasked ?? "Not set"}</Text><Text size="sm">Linked user: {profile.userId ?? "None"}</Text>{canManage && <Group><Button variant="light" onClick={() => setModal("edit")}>Edit profile</Button><Button onClick={() => setModal("compensation")}>Add compensation version</Button></Group>}</Stack></Card>)}
    {profile && (history.isLoading ? <PanelSkeleton label="Loading compensation history" /> : history.isError ? <Alert color="red">Compensation history could not be loaded. <Button variant="subtle" onClick={() => history.refetch()}>Retry</Button></Alert> : !history.data?.data.length ? <Text c="dimmed">No compensation history.</Text> : history.data.data.map((version) => <Card withBorder key={version.id}><Stack gap="xs"><Text fw={700}>{version.effectiveFrom} to {version.effectiveTo ?? "open ended"}</Text><Text size="sm">Version #{version.id} · {version.sourceNote ?? "No source note"}</Text><Table><Table.Tbody>{version.components.map((row) => <Table.Tr key={row.id}><Table.Td>{row.type.replace("_", " ")}</Table.Td><Table.Td>{row.code} · {row.name}</Table.Td><Table.Td>{formatPaise(row.amountPaise)}</Table.Td></Table.Tr>)}</Table.Tbody></Table><Text size="sm">Gross {formatPaise(version.totals.grossPayPaise)} · Deductions {formatPaise(version.totals.deductionPaise)} · Net {formatPaise(version.totals.netPayPaise)}</Text><Text fw={700}>Employer cost {formatPaise(version.totals.totalEmployerCostPaise)}</Text></Stack></Card>))}
    <Modal opened={canManage && modal !== null} onClose={() => setModal(null)} title={modal === "create" ? "Create payroll profile" : modal === "edit" ? "Edit payroll profile" : "Add compensation version"} size="lg">{canManage && modal === "create" && <PayrollProfileForm storeId={storeId} onSaved={(id) => { setPage(1); setProfileId(id); setModal(null); }} />}{canManage && profile && modal === "edit" && <PayrollProfileForm profile={profile} storeId={storeId} onSaved={() => setModal(null)} />}{canManage && profile && modal === "compensation" && <CompensationForm profileId={profile.id} onSaved={() => setModal(null)} />}</Modal>
  </Stack>;
}
