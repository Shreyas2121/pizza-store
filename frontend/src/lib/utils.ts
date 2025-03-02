import { notifications } from "@mantine/notifications";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const error = (msg: string) => {
  return notifications.show({
    title: "Error",
    message: msg,
    color: "red",
  });
};

export const success = (msg: string) => {
  return notifications.show({
    title: "Success",
    message: msg,
    color: "green",
  });
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(price);
};

export const cap = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};
