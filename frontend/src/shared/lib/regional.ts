export const APP_LOCALE = "en-IN";
export const APP_CURRENCY = "INR";
export const APP_TIME_ZONE = "Asia/Kolkata";
export const APP_CURRENCY_SYMBOL = "₹";

type DateValue = string | number | Date;

const moneyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: APP_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const clockFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: "UTC",
  hour: "numeric",
  minute: "2-digit",
});

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getDateFormatter = (options: Intl.DateTimeFormatOptions) => {
  const resolvedOptions = { ...options, timeZone: APP_TIME_ZONE };
  const key = JSON.stringify(resolvedOptions);
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(APP_LOCALE, resolvedOptions);
  formatterCache.set(key, formatter);
  return formatter;
};

const parseDate = (value: DateValue) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatPrice = (price: number) => moneyFormatter.format(price);

export const formatDate = (
  value: DateValue,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) => {
  const date = parseDate(value);
  return date ? getDateFormatter(options).format(date) : "Date unavailable";
};

export const formatDateTime = (
  value: DateValue,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
) => {
  const date = parseDate(value);
  return date ? getDateFormatter(options).format(date) : "Date unavailable";
};

export const formatTime = (value: DateValue) => {
  const date = parseDate(value);
  return date
    ? getDateFormatter({ hour: "numeric", minute: "2-digit" }).format(date)
    : "";
};

export const formatClockTime = (value: string) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return value;

  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  return clockFormatter.format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
};

export const formatStoreHours = (opensAt: string, closesAt: string) =>
  `${formatClockTime(opensAt)}–${formatClockTime(closesAt)}`;
