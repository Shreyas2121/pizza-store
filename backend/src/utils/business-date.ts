import { AppError } from "./error";

export const businessDateFor = (instant: Date, timezone: string) => {
  if (Number.isNaN(instant.getTime())) throw new AppError("Business time is invalid", 422, "INVALID_BUSINESS_TIME");
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(instant);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    throw new AppError("Store timezone is invalid", 422, "INVALID_STORE_TIMEZONE");
  }
};
