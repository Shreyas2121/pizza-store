import { z } from "zod";

export const storeIdSchema = z.coerce
  .number()
  .int("Store ID must be an integer")
  .positive("Store ID must be positive");

export const parseStoreId = (value: unknown): number => storeIdSchema.parse(value);
