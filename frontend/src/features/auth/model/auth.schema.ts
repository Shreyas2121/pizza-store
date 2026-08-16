import { z } from "zod";

export const registerSchema = z
  .object({
    fname: z.string().trim().min(2, "Enter at least 2 characters").max(255),
    lname: z.string().trim().min(2, "Enter at least 2 characters").max(255),
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(4, "Use at least 4 characters").max(255),
    cpassword: z.string().min(4, "Repeat your password").max(255),
  })
  .refine(
    (value) => value.password === value.cpassword,
    { message: "Passwords do not match", path: ["cpassword"] }
  );

export type TRegister = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(4, "Enter your password").max(255),
});

export type TLogin = z.infer<typeof loginSchema>;
