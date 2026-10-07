import { z } from "zod";
import { MONEY_CAPS } from "../../utils/money";

export const customizationGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(["single", "multiple"]),
  required: z.boolean().default(false),
}).strict();

export const customizationOptionSchema = z.object({
  groupId: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  pricePaise: z.number().int().min(0).max(MONEY_CAPS.CUSTOMIZATION_PRICE).default(0),
  isAvailable: z.boolean().default(true),
}).strict();

export const customizationMappingSchema = z.object({
  groupId: z.number().int().positive(),
  productIds: z.array(z.number().int().positive()),
}).strict();
