import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { payrollKeys, useCreateCompensation, useCreatePayrollProfile, usePayrollProfile, usePayrollProfiles, useUpdatePayrollProfile } from "./api/payroll.queries";
import { buildCompensationWrite, buildProfileWrite, type CompensationDraft } from "./model/payroll.forms";
import { PayrollProfileForm, PayrollProfilesPanel } from "./components/payroll-profiles-panel";
import type { PayrollProfile } from "./model/payroll.types";

vi.spyOn(API, "get"); vi.spyOn(API, "post"); vi.spyOn(API, "put");
let client: QueryClient;
beforeEach(() => { vi.resetAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } }); });
afterEach(() => client.clear());
const render = (element: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test">{element}</MantineProvider></QueryClientProvider>);
function capture<T>(hook: () => T): T { let result: T | undefined; function Harness() { result = hook(); return null; } render(createElement(Harness)); if (!result) throw new Error("Hook did not render"); return result; }
const fields = { userId: 5, employeeCode: "emp_01", displayName: " Employee ", employmentStartDate: "2026-10-01", employmentEndDate: null, status: "active" as const, payFrequency: "monthly" as const };
const keep = { mode: "keep" as const, value: "****1234" };
const profile: PayrollProfile = { ...fields, id: 7, storeId: 1, bankAccountMasked: "****1234", taxIdentifierMasked: "****5678" };
const draft = (): CompensationDraft => ({ effectiveFrom: "2026-10-01", effectiveTo: "", sourceNote: "", components: [{ type: "earning", code: "basic", name: "Basic pay", amount: "100.01" }, { type: "deduction", code: "DEDUCT", name: "Deduction", amount: "0.01" }] });

describe("payroll profile management", () => {
  it("preserves sensitive values by omission and explicitly replaces or clears them", () => {
    const data = buildProfileWrite(fields, keep, keep);
    expect(data).not.toHaveProperty("bankAccountNumber"); expect(data).not.toHaveProperty("taxIdentifier");
    expect(data.employeeCode).toBe("EMP_01"); expect(data.displayName).toBe("Employee");
    const changed = buildProfileWrite(fields, { mode: "replace", value: " abc123456 " }, { mode: "clear", value: "" });
    expect(changed.bankAccountNumber).toBe("ABC123456"); expect(changed.taxIdentifier).toBeNull();
  });
  it("rejects invalid employment dates and terminated profiles without an end date", () => {
    expect(() => buildProfileWrite({ ...fields, status: "terminated" }, keep, keep)).toThrow("end date");
    expect(() => buildProfileWrite({ ...fields, employmentEndDate: "2026-09-30" }, keep, keep)).toThrow("precede");
    expect(() => buildProfileWrite({ ...fields, employmentStartDate: "2026-02-30" }, keep, keep)).toThrow();
    expect(() => buildProfileWrite(fields, { mode: "replace", value: "****1234" }, keep)).toThrow();
  });
  it("loads paginated store profiles and separates store and page caches", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: [profile] } });
    await capture(() => usePayrollProfiles(1, 2)).refetch();
    expect(API.get).toHaveBeenCalledWith("/finance/payroll/profiles", { params: { storeId: 1, page: 2, limit: 25 }, signal: expect.any(AbortSignal) });
    expect(capture(() => usePayrollProfiles(2, 2)).data).toBeUndefined(); expect(capture(() => usePayrollProfiles(1, 1)).data).toBeUndefined();
  });
  it("loads the authoritative masked profile detail", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: profile } });
    const result = await capture(() => usePayrollProfile(7)).refetch();
    expect(result.data?.data.bankAccountMasked).toBe("****1234");
    expect(API.get).toHaveBeenCalledWith("/finance/payroll/profiles/7", { signal: expect.any(AbortSignal) });
  });
  it("creates and updates profiles using the intended store and refreshes payroll caches", async () => {
    client.setQueryData(payrollKeys.profile(7), { data: profile });
    vi.mocked(API.post).mockResolvedValue({ data: { data: profile } }); vi.mocked(API.put).mockResolvedValue({ data: { data: profile } });
    const data = buildProfileWrite(fields, keep, keep);
    await capture(useCreatePayrollProfile).mutateAsync({ ...data, storeId: 1 });
    expect(API.post).toHaveBeenCalledWith("/finance/payroll/profiles", { ...data, storeId: 1 });
    await capture(useUpdatePayrollProfile).mutateAsync({ profileId: 7, data });
    expect(API.put).toHaveBeenCalledWith("/finance/payroll/profiles/7", data);
    expect(client.getQueryState(payrollKeys.profile(7))?.isInvalidated).toBe(true);
  });
  it("keeps masked identifiers out of editable input values", () => {
    const html = render(<PayrollProfileForm profile={profile} storeId={1} onSaved={() => {}} />);
    expect(html).toContain("Keep existing"); expect(html).toContain("****1234");
    expect(html).not.toContain('value="****1234"'); expect(html).not.toContain('value="****5678"');
  });
  it("only shows profile creation for managers", () => {
    client.setQueryData(payrollKeys.profiles(1), { data: [], meta: { totalPages: 0 } });
    expect(render(<PayrollProfilesPanel storeId={1} canManage={false} />)).not.toContain("Create payroll profile");
    expect(render(<PayrollProfilesPanel storeId={1} canManage />)).toContain("Create payroll profile");
  });
});
describe("compensation creation", () => {
  it("converts exact rupees, normalizes codes and leaves optional fields null", async () => {
    const data = buildCompensationWrite(draft());
    expect(data.components.map((row) => row.amountPaise)).toEqual([10001, 1]); expect(data.components[0].code).toBe("BASIC");
    expect(data.effectiveTo).toBeNull(); expect(data.sourceNote).toBeNull();
    vi.mocked(API.post).mockResolvedValue({ data: { data: { id: 8 } } });
    await capture(useCreateCompensation).mutateAsync({ profileId: 7, data });
    expect(API.post).toHaveBeenCalledWith("/finance/payroll/profiles/7/compensation", data);
  });
  it("rejects fractional paise, negative, blank and excessive amounts", () => {
    for (const amount of ["", "0", "-1", "1.001", "1000000.01"]) { const value = draft(); value.components[0].amount = amount; expect(() => buildCompensationWrite(value)).toThrow(); }
  });
  it("rejects duplicate normalized codes, deductions above earnings and reversed dates", () => {
    const duplicate = draft(); duplicate.components.push({ ...duplicate.components[0], code: "BASIC" }); expect(() => buildCompensationWrite(duplicate)).toThrow("unique");
    const deductions = draft(); deductions.components[1].amount = "101"; expect(() => buildCompensationWrite(deductions)).toThrow("exceed earnings");
    expect(() => buildCompensationWrite({ ...draft(), effectiveTo: "2026-09-30" })).toThrow("precede");
    expect(() => buildCompensationWrite({ ...draft(), components: [draft().components[1]] })).toThrow("earning");
  });
  it("surfaces server overlap failures without invalidating saved history", async () => {
    client.setQueryData(payrollKeys.compensation(7), { data: [] });
    vi.mocked(API.post).mockRejectedValue(new Error("Compensation dates overlap"));
    await expect(capture(useCreateCompensation).mutateAsync({ profileId: 7, data: buildCompensationWrite(draft()) })).rejects.toThrow("overlap");
    expect(client.getQueryState(payrollKeys.compensation(7))?.isInvalidated).toBe(false);
  });
});
