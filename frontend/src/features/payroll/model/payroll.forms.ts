import { z } from "zod";
import { parseRupeesToPaise } from "@/shared/lib";
import type { ComponentType, CompensationWrite, PayrollProfileWrite } from "./payroll.types";

const identifier = z.string().trim().min(6).max(34).regex(/^[A-Za-z0-9]+$/).transform((value) => value.toUpperCase()).nullable().optional();
const profileSchema = z.object({
  userId: z.number().int().positive().nullable(),
  employeeCode: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).transform((value) => value.toUpperCase()),
  displayName: z.string().trim().min(1).max(160),
  employmentStartDate: z.iso.date(), employmentEndDate: z.iso.date().nullable(),
  status: z.enum(["active", "on_leave", "terminated"]), payFrequency: z.literal("monthly"),
  bankAccountNumber: identifier, taxIdentifier: identifier,
}).superRefine((value, context) => {
  if (value.employmentEndDate && value.employmentEndDate < value.employmentStartDate) context.addIssue({ code: "custom", message: "Employment end date cannot precede the start date." });
  if (value.status === "terminated" && !value.employmentEndDate) context.addIssue({ code: "custom", message: "A terminated profile requires an employment end date." });
});
export type SensitiveChange = { mode: "keep" | "replace" | "clear"; value: string };
export function buildProfileWrite(fields: Omit<PayrollProfileWrite, "bankAccountNumber" | "taxIdentifier">, bank: SensitiveChange, tax: SensitiveChange): PayrollProfileWrite {
  return profileSchema.parse({ ...fields,
    ...(bank.mode === "keep" ? {} : { bankAccountNumber: bank.mode === "clear" ? null : bank.value }),
    ...(tax.mode === "keep" ? {} : { taxIdentifier: tax.mode === "clear" ? null : tax.value }),
  });
}
export type CompensationDraft = { effectiveFrom: string; effectiveTo: string; sourceNote: string; components: Array<{ type: ComponentType; code: string; name: string; amount: number | string }> };
const compensationSchema = z.object({
  effectiveFrom: z.iso.date(), effectiveTo: z.iso.date().nullable(), sourceNote: z.string().trim().min(1).max(500).nullable(),
  components: z.array(z.object({ type: z.enum(["earning", "deduction", "employer_cost"]), code: z.string().trim().min(2).max(40).regex(/^[A-Za-z][A-Za-z0-9_]*$/).transform((value) => value.toUpperCase()), name: z.string().trim().min(1).max(120), amountPaise: z.number().int().positive().max(100_000_000) })).min(1).max(50),
}).superRefine((value, context) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) context.addIssue({ code: "custom", message: "Effective end date cannot precede the start date." });
  if (!value.components.some((component) => component.type === "earning")) context.addIssue({ code: "custom", message: "At least one earning component is required." });
  const keys = value.components.map((component) => `${component.type}:${component.code}`);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", message: "Component type and code must be unique." });
  const sum = (type: ComponentType) => value.components.filter((component) => component.type === type).reduce((total, component) => total + component.amountPaise, 0);
  if (sum("deduction") > sum("earning")) context.addIssue({ code: "custom", message: "Deductions cannot exceed earnings." });
  if (sum("earning") + sum("employer_cost") > 100_000_000) context.addIssue({ code: "custom", message: "Total employer cost must not exceed ₹1,000,000." });
});
export function buildCompensationWrite(draft: CompensationDraft): CompensationWrite {
  return compensationSchema.parse({ ...draft, effectiveTo: draft.effectiveTo || null, sourceNote: draft.sourceNote.trim() || null, components: draft.components.map(({ amount, ...component }) => ({ ...component, amountPaise: parseRupeesToPaise(amount) })) });
}
