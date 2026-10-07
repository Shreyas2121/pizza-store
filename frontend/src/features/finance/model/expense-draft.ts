import { z } from "zod";
import { parseRupeesToPaise } from "@/shared/lib";
import type { ExpenseDetail, ExpenseWritePayload } from "./finance.types";

export type ExpenseDraft = {
  vendorId: string | null; date: string; description: string; subtotal: number | string; tax: number | string;
  allocations: Array<{ storeId: number; categoryId: string | null; categoryName?: string; costCenter: string; amount: number | string }>;
};
export const expenseDraftFromDetail = (storeId: number, detail?: ExpenseDetail): ExpenseDraft => ({
  vendorId: detail?.expense.vendorId ? String(detail.expense.vendorId) : null,
  date: detail?.expense.expenseDate ?? new Date().toISOString().slice(0, 10),
  description: detail?.expense.description ?? "",
  subtotal: (detail?.expense.subtotalPaise ?? 0) / 100,
  tax: (detail?.expense.taxPaise ?? 0) / 100,
  allocations: detail ? detail.allocations.map((item) => ({ storeId: item.storeId, categoryId: String(item.categoryId), categoryName: item.categoryName, costCenter: item.costCenter ?? "", amount: item.amountPaise / 100 })) : [{ storeId, categoryId: null, costCenter: "", amount: 0 }],
});
const amount = z.number().int().min(0).max(50_000_000);
const payloadSchema = z.object({
  vendorId: z.number().int().positive().nullable(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an expense date."),
  description: z.string().trim().min(1, "Enter a description.").max(1000),
  subtotalPaise: amount, taxPaise: amount, totalPaise: amount.positive(),
  allocations: z.array(z.object({ storeId: z.number().int().positive(), categoryId: z.number().int().positive("Choose a category for every allocation."), costCenter: z.string().min(1).max(120).nullable(), amountPaise: amount.positive() })).min(1).max(100),
}).superRefine((value, context) => {
  if (value.allocations.reduce((sum, item) => sum + item.amountPaise, 0) !== value.totalPaise) context.addIssue({ code: "custom", message: "Allocations must equal the expense total exactly." });
  const dimensions = value.allocations.map((item) => `${item.storeId}:${item.categoryId}:${item.costCenter ?? ""}`);
  if (new Set(dimensions).size !== dimensions.length) context.addIssue({ code: "custom", message: "Each store, category and cost center combination must be unique." });
});

export function buildExpenseUpdate(draft: ExpenseDraft): Omit<ExpenseWritePayload, "storeId"> {
  const subtotalPaise = parseRupeesToPaise(draft.subtotal);
  const taxPaise = parseRupeesToPaise(draft.tax);
  return payloadSchema.parse({ vendorId: draft.vendorId ? Number(draft.vendorId) : null, expenseDate: draft.date, description: draft.description.trim(), subtotalPaise, taxPaise, totalPaise: subtotalPaise + taxPaise,
    allocations: draft.allocations.map((item) => ({ storeId: item.storeId, categoryId: Number(item.categoryId), costCenter: item.costCenter.trim() || null, amountPaise: parseRupeesToPaise(item.amount) })),
  });
}
