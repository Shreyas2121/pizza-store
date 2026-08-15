import { format } from "date-fns";
import { GroupT } from "./types";

export const filterImage = (file: Express.Multer.File) => {
  return `/api/v1/${file.path.replace(/\\/g, "/")}`;
};

export const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, "-");
};

export const cap = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(price);
};

export const formatNumber = (num: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "decimal",
  }).format(num);
};

export const formatPeriod = (date: string, group: GroupT) => {
  const newDate = new Date(date);
  switch (group) {
    case "daily":
      return format(newDate, "MMM dd");
    case "monthly":
      return format(newDate, "MMM yyyy");
    case "quaterly":
      const quarter = Math.ceil((newDate.getMonth() + 1) / 3);
      return `Q${quarter} ${format(newDate, "yyyy")}`;
    case "yearly":
      return format(newDate, "yyyy");
    default:
      return format(newDate, "PPP");
  }
};
