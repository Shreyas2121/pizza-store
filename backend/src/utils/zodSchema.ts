import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  PORT: z.string().min(4).max(4),
  DB_HOST: z.string(),
  DB_PORT: z.string().min(4).max(4),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  JWT_SECRET: z.string(),
  RAZORPAY_KEY: z.string(),
  RAZORPAY_SECRET: z.string(),
});

export const env = envSchema.parse(process.env);

export const userSchema = z.object({
  username: z.string().min(3).max(255),
  email: z.string().email(),
  password: z.string().min(6).max(255),
  bio: z.string().max(255).optional(),
  profilePicture: z.string().url().optional(),
});
