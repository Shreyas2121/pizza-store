import { notifications } from "@mantine/notifications";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const error = (msg: string, title: string = "Error") => {
  return notifications.show({
    title,
    message: msg,
    color: "red",
    autoClose: 5000,
  });
};

export const success = (msg: string, title: string = "Success") => {
  return notifications.show({
    title,
    message: msg,
    color: "basil",
    autoClose: 4000,
  });
};

export const warning = (msg: string, title: string = "Warning") => {
  return notifications.show({
    title,
    message: msg,
    color: "yellow",
    autoClose: 4000,
  });
};

export const info = (msg: string, title: string = "Information") => {
  return notifications.show({
    title,
    message: msg,
    color: "brand",
    autoClose: 4000,
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
