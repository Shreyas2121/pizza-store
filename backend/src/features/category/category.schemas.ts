import { z } from "zod";

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(100),
}).strict();
