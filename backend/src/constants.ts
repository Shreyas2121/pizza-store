import { env } from "./utils/zodSchema";

export const URL =
  env.DATABASE_URL ||
  `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;

export const APP_LOCALE = "en-IN";
export const APP_CURRENCY = "INR";
export const APP_TIME_ZONE = "Asia/Kolkata";

export const groupToTrunc = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  yearly: "year",
} as const;
