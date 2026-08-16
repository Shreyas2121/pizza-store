import { z } from "zod";

export const addressSchema = z.object({
  type: z.enum(["Home", "Work", "Other"], { message: "Select an address type" }),
  street: z.string().trim().min(3, "Enter a street address"),
  city: z.string().trim().min(2, "Enter a city"),
  state: z.string().trim().min(2, "Enter a state"),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number"),
});

export type TAddress = z.infer<typeof addressSchema>;
