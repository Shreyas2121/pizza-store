import { z } from "zod";
import { MONEY_CAPS } from "../../utils/money";

const employeeCode = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).transform((value) => value.toUpperCase());
const displayName = z.string().trim().min(1).max(160);
const sensitiveIdentifier = z.string().trim().min(6).max(34).regex(/^[A-Za-z0-9]+$/).transform((value) => value.toUpperCase());
const businessDate = z.iso.date();

const employmentFields = {
  employmentStartDate: businessDate,
  employmentEndDate: businessDate.nullable().optional(),
  status: z.enum(["active", "on_leave", "terminated"]).default("active"),
};

const validateEmployment = (value: { employmentStartDate: string; employmentEndDate?: string | null; status: string }, ctx: z.RefinementCtx) => {
  if (value.employmentEndDate && value.employmentEndDate < value.employmentStartDate) {
    ctx.addIssue({ code: "custom", path: ["employmentEndDate"], message: "Employment end date cannot precede the start date" });
  }
  if (value.status === "terminated" && !value.employmentEndDate) {
    ctx.addIssue({ code: "custom", path: ["employmentEndDate"], message: "A terminated profile requires an employment end date" });
  }
};

export const payrollProfilesQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  status: z.enum(["active", "on_leave", "terminated"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const createPayrollProfileSchema = z.object({
  storeId: z.number().int().positive(),
  userId: z.number().int().positive().nullable().optional(),
  employeeCode,
  displayName,
  ...employmentFields,
  payFrequency: z.literal("monthly").default("monthly"),
  bankAccountNumber: sensitiveIdentifier.nullable().optional(),
  taxIdentifier: sensitiveIdentifier.nullable().optional(),
}).strict().superRefine(validateEmployment);

export const updatePayrollProfileSchema = z.object({
  userId: z.number().int().positive().nullable().optional(),
  employeeCode: employeeCode.optional(),
  displayName: displayName.optional(),
  employmentStartDate: businessDate.optional(),
  employmentEndDate: businessDate.nullable().optional(),
  status: z.enum(["active", "on_leave", "terminated"]).optional(),
  payFrequency: z.literal("monthly").optional(),
  bankAccountNumber: sensitiveIdentifier.nullable().optional(),
  taxIdentifier: sensitiveIdentifier.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const compensationVersionsQuerySchema = z.object({
  asOf: businessDate.optional(),
}).strict();

export const compensationComponentSchema = z.object({
  type: z.enum(["earning", "deduction", "employer_cost"]),
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z][A-Za-z0-9_]*$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  amountPaise: z.number().int().positive().max(MONEY_CAPS.PAY_RUN_AMOUNT),
}).strict();

export const createCompensationVersionSchema = z.object({
  effectiveFrom: businessDate,
  effectiveTo: businessDate.nullable().optional(),
  sourceNote: z.string().trim().min(1).max(500).nullable().optional(),
  components: z.array(compensationComponentSchema).min(1).max(50),
}).strict().superRefine((value, ctx) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo cannot be before effectiveFrom" });
  }
  if (!value.components.some((component) => component.type === "earning")) {
    ctx.addIssue({ code: "custom", path: ["components"], message: "At least one earning component is required" });
  }
  const keys = new Set<string>();
  value.components.forEach((component, index) => {
    const key = `${component.type}:${component.code}`;
    if (keys.has(key)) ctx.addIssue({ code: "custom", path: ["components", index, "code"], message: "Component type and code must be unique" });
    keys.add(key);
  });
});

export type PayrollProfilesQuery = z.infer<typeof payrollProfilesQuerySchema>;
export type CreatePayrollProfileInput = z.infer<typeof createPayrollProfileSchema>;
export type UpdatePayrollProfileInput = z.infer<typeof updatePayrollProfileSchema>;
export type CompensationVersionsQuery = z.infer<typeof compensationVersionsQuerySchema>;
export type CreateCompensationVersionInput = z.infer<typeof createCompensationVersionSchema>;
