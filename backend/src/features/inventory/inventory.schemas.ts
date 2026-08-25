import { z } from "zod";

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

export const inventoryListQuerySchema = z
  .object({
    status: z.enum(["all", "low_stock", "out_of_stock"]).default("all"),
    search: z.string().trim().max(100).optional(),
    page: pageSchema,
    limit: limitSchema,
  })
  .strict();

export const inventoryMovementsQuerySchema = z
  .object({
    changeType: z
      .enum(["sale", "restock", "adjustment", "return", "cancellation"])
      .optional(),
    productId: z.coerce.number().int().positive().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: pageSchema,
    limit: limitSchema,
  })
  .strict()
  .refine(
    ({ from, to }) => !from || !to || from <= to,
    { message: "From date must be before or equal to to date", path: ["from"] }
  );

export const restockInventorySchema = z
  .object({
    quantityAdded: z.number().int().positive().safe(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

const bulkRestockItemSchema = z
  .object({
    productId: z.number().int().positive().safe(),
    quantityAdded: z.number().int().positive().safe(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const bulkRestockInventorySchema = z
  .object({
    items: z.array(bulkRestockItemSchema).min(1).max(50),
  })
  .strict()
  .superRefine(({ items }, context) => {
    const seen = new Set<number>();
    items.forEach((item, index) => {
      if (seen.has(item.productId)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate product IDs are not allowed",
          path: ["items", index, "productId"],
        });
      }
      seen.add(item.productId);
    });
  });

export const adjustInventorySchema = z
  .object({
    targetQuantity: z.number().int().nonnegative().safe(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const updateInventoryThresholdSchema = z
  .object({
    threshold: z.number().int().nonnegative().safe(),
  })
  .strict();
