import { notifications } from "@mantine/notifications";

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
