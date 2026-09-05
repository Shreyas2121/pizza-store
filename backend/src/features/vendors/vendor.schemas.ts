import { z } from "zod";

const hasNoControlCharacters = (value: string) =>
  Array.from(value).every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 && code !== 127;
  });
const safeName = (max: number) => z.string().trim().min(1).max(max)
  .refine(hasNoControlCharacters, "Control characters are not allowed");
const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();
const includeInactive = z.enum(["true", "false"]).transform((value) => value === "true").default(false);

export const masterListQuerySchema = z.object({
  storeId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(100).optional(),
  includeInactive,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const createVendorSchema = z.object({
  storeId: z.number().int().positive().nullable().optional(),
  name: safeName(200),
  taxRegistrationNumber: nullableText(50).optional(),
  contactName: nullableText(120).optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: nullableText(30).optional(),
  address: nullableText(1000).optional(),
  paymentTermsDays: z.number().int().min(0).max(3650).default(0),
}).strict();

export const updateVendorSchema = createVendorSchema.omit({ storeId: true }).partial().extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const createExpenseCategorySchema = z.object({
  storeId: z.number().int().positive().nullable().optional(),
  parentId: z.number().int().positive().nullable().optional(),
  name: safeName(120),
  classification: z.enum(["fixed", "variable"]),
  ledgerAccountId: z.number().int().positive().nullable().optional(),
}).strict();

export const updateExpenseCategorySchema = createExpenseCategorySchema.omit({ storeId: true }).partial().extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export type MasterListQuery = z.infer<typeof masterListQuerySchema>;
export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;
