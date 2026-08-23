import { APP_LOCALE, APP_TIME_ZONE } from "../../constants";

const istTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const parseTime = (time: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
};

export const getIstTimeInMinutes = (date = new Date()) => {
  const parts = istTimeFormatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  return hour * 60 + minute;
};

export const formatStoreTime = (time: string) => {
  const minutes = parseTime(time);
  if (minutes === null) return time;

  const instant = new Date(
    Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60)
  );
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
};

export const isStoreOpen = (
  opensAt: string,
  closesAt: string,
  date = new Date()
) => {
  const opensAtMinutes = parseTime(opensAt);
  const closesAtMinutes = parseTime(closesAt);

  if (opensAtMinutes === null || closesAtMinutes === null) return false;
  if (opensAtMinutes === closesAtMinutes) return true;

  const currentMinutes = getIstTimeInMinutes(date);

  if (opensAtMinutes < closesAtMinutes) {
    return currentMinutes >= opensAtMinutes && currentMinutes < closesAtMinutes;
  }

  return currentMinutes >= opensAtMinutes || currentMinutes < closesAtMinutes;
};
