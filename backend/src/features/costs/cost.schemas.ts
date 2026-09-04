import { z } from "zod";

const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const costsQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  storeProductId: z.coerce.number().int().positive().optional(),
  asOf: businessDate.optional(),
}).strict();

export const createCostVersionSchema = z.object({
  storeId: z.number().int().positive(),
  storeProductId: z.number().int().positive(),
  unitCostPaise: z.number().int().min(0).max(2_147_483_647),
  effectiveFrom: businessDate,
  effectiveTo: businessDate.nullable().optional(),
  source: z.string().trim().min(1).max(255),
}).strict().superRefine((value, ctx) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo cannot be before effectiveFrom" });
  }
});

export type CostsQuery = z.infer<typeof costsQuerySchema>;
export type CreateCostVersionInput = z.infer<typeof createCostVersionSchema>;
