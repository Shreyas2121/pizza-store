import { env } from "./utils/zodSchema";

export const URL =
  env.DATABASE_URL ||
  `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;

export const groupToTrunc = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  yearly: "year",
} as const;
