import { z } from "zod";

const optionalCoordinate = z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  z.number().min(-180).max(180).nullable(),
);

export const storeSchema = z.object({
  name: z.string().trim().min(1, "Store name is required"),
  slug: z.string().trim().optional(),
  address: z.string().trim().min(1, "Address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  phone: z.string().trim().min(8, "Enter a valid phone number"),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional(),
  latitude: optionalCoordinate,
  longitude: optionalCoordinate,
  opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid opening time"),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid closing time"),
  isActive: z.boolean(),
});

export type StoreFormValues = z.infer<typeof storeSchema>;

