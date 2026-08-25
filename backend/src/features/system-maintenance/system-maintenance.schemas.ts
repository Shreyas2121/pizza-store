import { z } from "zod";

export const CLEAR_ALL_CONFIRMATION = "CLEAR EVERYTHING";

export const clearAllDataSchema = z
  .object({
    confirmation: z.literal(CLEAR_ALL_CONFIRMATION),
  })
  .strict();
