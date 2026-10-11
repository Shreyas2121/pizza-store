import { GroupT } from "./types";
import { APP_CURRENCY, APP_LOCALE, APP_TIME_ZONE } from "../constants";
import { uploadPublicImage, usesCloudinary } from "./cloudinary-storage";

export const filterImage = async (file: Express.Multer.File) => {
  if (usesCloudinary()) return uploadPublicImage(file.buffer, "catalog");
  return `/api/v1/uploads/${file.filename}`;
};

export const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const cap = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const formatPrice = (price: number) => {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency: APP_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

export const formatNumber = (num: number) => {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: "decimal",
  }).format(num);
};

export const formatPeriod = (date: string, group: GroupT) => {
  const newDate = new Date(date);
  const dateOptions: Intl.DateTimeFormatOptions = { timeZone: APP_TIME_ZONE };
  switch (group) {
    case "daily":
      return new Intl.DateTimeFormat(APP_LOCALE, { ...dateOptions, month: "short", day: "2-digit" }).format(newDate);
    case "monthly":
      return new Intl.DateTimeFormat(APP_LOCALE, { ...dateOptions, month: "short", year: "numeric" }).format(newDate);
    case "quarterly":
      const month = Number(new Intl.DateTimeFormat("en", { ...dateOptions, month: "numeric" }).format(newDate));
      const year = new Intl.DateTimeFormat("en", { ...dateOptions, year: "numeric" }).format(newDate);
      return `Q${Math.ceil(month / 3)} ${year}`;
    case "yearly":
      return new Intl.DateTimeFormat("en", { ...dateOptions, year: "numeric" }).format(newDate);
    default:
      return new Intl.DateTimeFormat(APP_LOCALE, { ...dateOptions, dateStyle: "medium" }).format(newDate);
  }
};
