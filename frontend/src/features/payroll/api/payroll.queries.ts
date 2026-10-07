import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/shared/api";
import type { CompensationVersion, CompensationWrite, PageMeta, PayRun, PayRunDetail, PayStatement, PayrollPolicy, PayrollProfile, PayrollProfileWrite } from "../model/payroll.types";

export const payrollKeys = {
  root: ["payroll"] as const,
  profiles: (storeId: number | null, page = 1) => ["payroll", "profiles", storeId, page] as const,
  profile: (id: number | null) => ["payroll", "profile", id] as const,
  compensation: (profileId: number | null) => ["payroll", "compensation", profileId] as const,
  runs: (storeId: number | null) => ["payroll", "runs", storeId] as const,
  run: (id: number | null) => ["payroll", "run", id] as const,
  statement: (runId: number | null, employeeId: number | null) => ["payroll", "statement", runId, employeeId] as const,
};
const keys = payrollKeys;
type List<T> = { data: T[]; meta: PageMeta; policy: PayrollPolicy };
type Detail<T> = { data: T; policy: PayrollPolicy };

export const usePayrollProfiles = (storeId: number | null, page = 1) => useQuery({ queryKey: keys.profiles(storeId, page), queryFn: async ({ signal }) => (await API.get<List<PayrollProfile>>("/finance/payroll/profiles", { params: { storeId, page, limit: 25 }, signal })).data, enabled: Boolean(storeId) });
export const usePayrollProfile = (id: number | null) => useQuery({ queryKey: keys.profile(id), queryFn: async ({ signal }) => (await API.get<Detail<PayrollProfile>>(`/finance/payroll/profiles/${id}`, { signal })).data, enabled: Boolean(id) });
export const useCompensationHistory = (profileId: number | null) => useQuery({ queryKey: keys.compensation(profileId), queryFn: async () => (await API.get<Detail<CompensationVersion[]>>(`/finance/payroll/profiles/${profileId}/compensation`)).data, enabled: Boolean(profileId) });
export const usePayRuns = (storeId: number | null) => useQuery({ queryKey: keys.runs(storeId), queryFn: async () => (await API.get<List<PayRun>>("/finance/payroll/pay-runs", { params: { storeId, limit: 100 } })).data, enabled: Boolean(storeId) });
export const usePayRun = (id: number | null) => useQuery({ queryKey: keys.run(id), queryFn: async () => (await API.get<Detail<PayRunDetail>>(`/finance/payroll/pay-runs/${id}`)).data, enabled: Boolean(id) });
export const usePayStatement = (runId: number | null, employeeId: number | null) => useQuery({ queryKey: keys.statement(runId, employeeId), queryFn: async () => (await API.get<Detail<PayStatement>>(`/finance/payroll/pay-runs/${runId}/statements/${employeeId}`)).data, enabled: Boolean(runId && employeeId) });

const usePayrollMutation = <TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) => {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries({ queryKey: keys.root }) });
};
export const useCreatePayrollProfile = () => usePayrollMutation(async (input: PayrollProfileWrite & { storeId: number }) => (await API.post<Detail<PayrollProfile>>("/finance/payroll/profiles", input)).data);
export const useUpdatePayrollProfile = () => usePayrollMutation(async (input: { profileId: number; data: PayrollProfileWrite }) => (await API.put<Detail<PayrollProfile>>(`/finance/payroll/profiles/${input.profileId}`, input.data)).data);
export const useCreateCompensation = () => usePayrollMutation(async (input: { profileId: number; data: CompensationWrite }) => (await API.post<Detail<CompensationVersion>>(`/finance/payroll/profiles/${input.profileId}/compensation`, input.data)).data);
export const useCreatePayRun = () => usePayrollMutation(async (input: { storeId: number; periodStart: string; periodEnd: string }) => (await API.post("/finance/payroll/pay-runs", input, { headers: { "Idempotency-Key": crypto.randomUUID() } })).data);
export const usePayRunCommand = () => usePayrollMutation(async (input: { payRunId: number; action: "calculate" | "approve" | "pay" | "post" | "void" | "reverse"; data?: Record<string, unknown> }) => (await API.post(`/finance/payroll/pay-runs/${input.payRunId}/${input.action}`, input.data ?? {}, { headers: { "Idempotency-Key": crypto.randomUUID() } })).data);
export const useDownloadPayRun = () => useMutation({ mutationFn: async (runId: number) => { const response = await API.get<Blob>(`/finance/payroll/pay-runs/${runId}/export`, { responseType: "blob" }); const disposition = String(response.headers["content-disposition"] ?? ""); const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `pay-run-${runId}.csv`; const url = URL.createObjectURL(response.data); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); return filename; } });
