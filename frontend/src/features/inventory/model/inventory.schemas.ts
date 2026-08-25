import { z } from "zod";

const safeInteger = z
  .number({ invalid_type_error: "Enter a whole number" })
  .int("Enter a whole number")
  .max(Number.MAX_SAFE_INTEGER, "Quantity is too large");

export const restockSchema = z.object({
  quantityAdded: safeInteger.min(1, "Quantity must be at least 1"),
  reason: z.string().trim().max(500, "Reason must be 500 characters or less"),
});

export const adjustmentSchema = z.object({
  targetQuantity: safeInteger.min(0, "Quantity cannot be negative"),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(500, "Reason must be 500 characters or less"),
});

export const thresholdSchema = z.object({
  threshold: safeInteger.min(0, "Threshold cannot be negative"),
});

export type RestockValues = z.infer<typeof restockSchema>;
export type AdjustmentValues = z.infer<typeof adjustmentSchema>;
export type ThresholdValues = z.infer<typeof thresholdSchema>;
