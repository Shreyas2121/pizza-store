import { z } from "zod";

export const productSchema = z.object({
  name: z.string().nonempty().min(3),
  description: z.string().optional(),
  price: z.number().positive(),
  isVeg: z.boolean(),
  productType: z.enum(["single", "bundle"]),
  categoryId: z.number().positive(),
  image: z.custom<File>(
    (file) => {
      if (!(file instanceof File)) return false;
      const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
      if (!allowedTypes.includes(file.type)) return false;
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) return false;
      return true;
    },
    { message: "Invalid image file. Must be a JPEG, PNG, or GIF under 5MB." }
  ),
});

export type TProduct = z.infer<typeof productSchema>;

export const menuSchema = z.object({
  name: z.string().nonempty().min(3),
  position: z.number().positive(),
  image: z.custom<File>(
    (file) => {
      if (!(file instanceof File)) return false;
      const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
      if (!allowedTypes.includes(file.type)) return false;
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) return false;
      return true;
    },
    { message: "Invalid image file. Must be a JPEG, PNG, or GIF under 5MB." }
  ),
  productIds: z.array(z.number().positive()).nonempty(),
});

export type TMenu = z.infer<typeof menuSchema>;
