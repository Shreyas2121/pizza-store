import React from "react";
import { notifications, NotificationData } from "@mantine/notifications";
import { Check, AlertCircle, AlertTriangle, Info } from "lucide-react";

export const success = (
  msg: React.ReactNode,
  title: string = "Success",
  options?: Partial<NotificationData>
) => {
  return notifications.show({
    title,
    message: msg,
    color: "basil",
    icon: React.createElement(Check, {
      className: "w-4 h-4 text-basil stroke-[2.5]",
    }),
    autoClose: 4000,
    withBorder: true,
    className: "toast-success",
    ...options,
  });
};

export const error = (
  msg: React.ReactNode,
  title: string = "Error",
  options?: Partial<NotificationData>
) => {
  return notifications.show({
    title,
    message: msg,
    color: "danger",
    icon: React.createElement(AlertCircle, {
      className: "w-4 h-4 text-danger stroke-[2.5]",
    }),
    autoClose: 5000,
    withBorder: true,
    className: "toast-error",
    ...options,
  });
};

export const warning = (
  msg: React.ReactNode,
  title: string = "Warning",
  options?: Partial<NotificationData>
) => {
  return notifications.show({
    title,
    message: msg,
    color: "gold",
    icon: React.createElement(AlertTriangle, {
      className: "w-4 h-4 text-amber-700 stroke-[2.5]",
    }),
    autoClose: 4000,
    withBorder: true,
    className: "toast-warning",
    ...options,
  });
};

export const info = (
  msg: React.ReactNode,
  title: string = "Information",
  options?: Partial<NotificationData>
) => {
  return notifications.show({
    title,
    message: msg,
    color: "brand",
    icon: React.createElement(Info, {
      className: "w-4 h-4 text-brand stroke-[2.5]",
    }),
    autoClose: 4000,
    withBorder: true,
    className: "toast-info",
    ...options,
  });
};

export const toast = {
  success,
  error,
  warning,
  info,
  show: notifications.show,
  hide: notifications.hide,
  clean: notifications.clean,
  cleanQueue: notifications.cleanQueue,
};
