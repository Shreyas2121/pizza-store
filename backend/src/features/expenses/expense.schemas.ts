import { z } from "zod";
import { EXPENSE_PAYMENT_METHODS, EXPENSE_STATUSES } from "../../utils/types";
import { MONEY_CAPS } from "../../utils/money";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD");
const reason = z.string().trim().min(3).max(1000);
const allocation = z.object({
  storeId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  costCenter: z.string().trim().min(1).max(120).nullable().optional(),
  amountPaise: z.number().int().positive().max(MONEY_CAPS.EXPENSE_AMOUNT),
}).strict();

const expenseWriteFields = {
  storeId: z.number().int().positive(),
  vendorId: z.number().int().positive().nullable().optional(),
  expenseDate: date,
  description: z.string().trim().min(1).max(1000),
  subtotalPaise: z.number().int().nonnegative().max(MONEY_CAPS.EXPENSE_AMOUNT),
  taxPaise: z.number().int().nonnegative().max(MONEY_CAPS.EXPENSE_AMOUNT).default(0),
  totalPaise: z.number().int().positive().max(MONEY_CAPS.EXPENSE_AMOUNT),
  allocations: z.array(allocation).min(1).max(100),
};
const exactTotals = (value: { subtotalPaise: number; taxPaise: number; totalPaise: number; allocations: Array<{ storeId: number; categoryId: number; costCenter?: string | null; amountPaise: number }> }, ctx: z.RefinementCtx) => {
  if (value.subtotalPaise + value.taxPaise !== value.totalPaise) ctx.addIssue({ code: "custom", path: ["totalPaise"], message: "Total must equal subtotal plus tax" });
  if (value.allocations.reduce((sum, item) => sum + item.amountPaise, 0) !== value.totalPaise) ctx.addIssue({ code: "custom", path: ["allocations"], message: "Allocations must equal the expense total exactly" });
  const dimensions = new Set<string>();
  value.allocations.forEach((item, index) => {
    const key = `${item.storeId}:${item.categoryId}:${item.costCenter ?? ""}`;
    if (dimensions.has(key)) ctx.addIssue({ code: "custom", path: ["allocations", index], message: "Allocation dimensions must be unique" });
    dimensions.add(key);
  });
};

const expenseWriteObject = z.object(expenseWriteFields).strict();
export const expenseWriteSchema = expenseWriteObject.superRefine(exactTotals);
export const updateExpenseSchema = expenseWriteObject.omit({ storeId: true }).superRefine(exactTotals);
export const expensesQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  status: z.enum(EXPENSE_STATUSES).optional(),
  from: date.optional(),
  to: date.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, { message: "from must not be after to", path: ["from"] });

export const emptyExpenseCommandSchema = z.object({}).strict();
export const rejectExpenseSchema = z.object({ reason }).strict();
export const payExpenseSchema = z.object({
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
  paymentReference: z.string().trim().min(1).max(200).nullable().optional(),
  segregationOverrideReason: reason.optional(),
}).strict();
export const voidExpenseSchema = z.object({
  reason,
  paymentReversed: z.boolean().optional(),
  reversalReference: z.string().trim().min(1).max(200).optional(),
}).strict();
export const reverseExpenseSchema = z.object({ reason }).strict();
export const expenseIdempotencyKeySchema = z.string().trim().uuid("Idempotency-Key must be a UUID");

export type ExpenseWriteInput = z.infer<typeof expenseWriteSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpensesQueryInput = z.infer<typeof expensesQuerySchema>;
export type PayExpenseInput = z.infer<typeof payExpenseSchema>;
export type VoidExpenseInput = z.infer<typeof voidExpenseSchema>;
export type ExpenseCommandAction = "submit" | "approve" | "reject" | "pay" | "post" | "void" | "reverse";
