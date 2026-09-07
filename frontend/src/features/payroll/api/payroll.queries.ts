import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/shared/api";
import type { CompensationVersion, PageMeta, PayRun, PayRunDetail, PayStatement, PayrollPolicy, PayrollProfile } from "../model/payroll.types";

const keys = {
  root: ["payroll"] as const,
  profiles: (storeId: number | null) => ["payroll", "profiles", storeId] as const,
  compensation: (profileId: number | null) => ["payroll", "compensation", profileId] as const,
  runs: (storeId: number | null) => ["payroll", "runs", storeId] as const,
  run: (id: number | null) => ["payroll", "run", id] as const,
  statement: (runId: number | null, employeeId: number | null) => ["payroll", "statement", runId, employeeId] as const,
};
type List<T> = { data: T[]; meta: PageMeta; policy: PayrollPolicy };
type Detail<T> = { data: T; policy: PayrollPolicy };

export const usePayrollProfiles = (storeId: number | null) => useQuery({ queryKey: keys.profiles(storeId), queryFn: async () => (await API.get<List<PayrollProfile>>("/finance/payroll/profiles", { params: { storeId, limit: 100 } })).data, enabled: Boolean(storeId), placeholderData: keepPreviousData });
export const useCompensationHistory = (profileId: number | null) => useQuery({ queryKey: keys.compensation(profileId), queryFn: async () => (await API.get<Detail<CompensationVersion[]>>(`/finance/payroll/profiles/${profileId}/compensation`)).data, enabled: Boolean(profileId) });
export const usePayRuns = (storeId: number | null) => useQuery({ queryKey: keys.runs(storeId), queryFn: async () => (await API.get<List<PayRun>>("/finance/payroll/pay-runs", { params: { storeId, limit: 100 } })).data, enabled: Boolean(storeId), placeholderData: keepPreviousData });
export const usePayRun = (id: number | null) => useQuery({ queryKey: keys.run(id), queryFn: async () => (await API.get<Detail<PayRunDetail>>(`/finance/payroll/pay-runs/${id}`)).data, enabled: Boolean(id) });
export const usePayStatement = (runId: number | null, employeeId: number | null) => useQuery({ queryKey: keys.statement(runId, employeeId), queryFn: async () => (await API.get<Detail<PayStatement>>(`/finance/payroll/pay-runs/${runId}/statements/${employeeId}`)).data, enabled: Boolean(runId && employeeId) });

const usePayrollMutation = <TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) => {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries({ queryKey: keys.root }) });
};
export const useCreatePayRun = () => usePayrollMutation(async (input: { storeId: number; periodStart: string; periodEnd: string }) => (await API.post("/finance/payroll/pay-runs", input, { headers: { "Idempotency-Key": crypto.randomUUID() } })).data);
export const usePayRunCommand = () => usePayrollMutation(async (input: { payRunId: number; action: "calculate" | "approve" | "pay" | "post" | "void" | "reverse"; data?: Record<string, unknown> }) => (await API.post(`/finance/payroll/pay-runs/${input.payRunId}/${input.action}`, input.data ?? {}, { headers: { "Idempotency-Key": crypto.randomUUID() } })).data);
export const useDownloadPayRun = () => useMutation({ mutationFn: async (runId: number) => { const response = await API.get<Blob>(`/finance/payroll/pay-runs/${runId}/export`, { responseType: "blob" }); const disposition = String(response.headers["content-disposition"] ?? ""); const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `pay-run-${runId}.csv`; const url = URL.createObjectURL(response.data); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); return filename; } });
