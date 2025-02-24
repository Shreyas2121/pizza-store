import { z } from "zod";

export const registerSchema = z
  .object({
    fname: z.string().min(2).max(255),
    lname: z.string().min(2).max(255),
    email: z.string().email().nonempty(),
    password: z.string().min(4).max(255),
    cpassword: z.string().min(4).max(255),
  })
  .refine(
    (value) => value.password === value.cpassword,
    "Passwords do not match"
  );

export type TRegister = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().nonempty(),
  password: z.string().min(4).max(255),
});

export type TLogin = z.infer<typeof loginSchema>;
