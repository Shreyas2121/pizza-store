import { env } from "./utils/zodSchema";

export const URL = `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;

export const groupToTrunc = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  quaterly: "quarter",
  yearly: "year",
} as const;
