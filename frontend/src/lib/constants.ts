import { MantineColorsTuple } from "@mantine/core";
import {
  Box,
  Home,
  MapPin,
  ShoppingCart,
  Sliders,
  Tag,
  User,
  MessageCircleQuestionIcon,
} from "lucide-react";
import { ChatStatus } from "./types";

export const orderStatus = [
  {
    label: "Pending",
    value: "pending",
  },
  {
    label: "Preparing",
    value: "preparing",
  },
  {
    label: "Delivered",
    value: "delivered",
  },
  {
    label: "Cancelled",
    value: "cancelled",
  },
];

export const chatStatus: {
  label: string;
  value: ChatStatus;
}[] = [
  {
    label: "Pending",
    value: "pending",
  },
  {
    label: "Open",
    value: "open",
  },
  {
    label: "Close",
    value: "close",
  },
  {
    label: "Rejected",
    value: "rejected",
  },
];

export const myColor: MantineColorsTuple = [
  "#ffe9ec",
  "#ffd3d6",
  "#f6a6ac",
  "#ef757e",
  "#e84c58",
  "#e5323f",
  "#e42332",
  "#cb1425",
  "#b60c20",
  "#a00019",
];

export const BASE_URL = import.meta.env.VITE_BACKEND_URL;

export const QUERY_KEYS = {
  user: {
    addressAll: "addressAll",
    address: "address",
    get: "get",
  },
  menu: {
    all: "menu-all",
  },
  chat: {
    messages: "chat-messages",
  },
  support: {
    admin: "all-support",
    user: "user-support",
    adminUserChat: "admin-user-chat",
  },
  products: {
    allMenu: "all-menu",
    groupC: "group",
    adminA: "adminA",
    adminS: "adminS",
    cat: "products-cat",
    group: "products-group",
  },
  dashboard: {
    homeCards: "dash-home-cards",
    homeCharts: "dash-home-charts",
  },
  customizations: {
    admin: "allCustomizationsA",
  },
  cart: {
    addProduct: "add-product",
    removeProduct: "remove-product",
    updateProduct: "update-product",
    getCart: "get-cart",
    clearCart: "clear-cart",
    cartCount: "cart-count",
    cartCheckout: "cart-checkout",
  },
  order: {
    all: "all",
    single: "single",
    adminAll: "admin-all-orders",
  },
  category: {
    select: "Select Category",
  },
};

export const navLinks = [
  { label: "Profile", to: "/profile", icon: User },
  { label: "Address", to: "/address", icon: MapPin },
  { label: "Orders", to: "/orders", icon: Box },
];

export const sidebarLinks = [
  {
    label: "Dashboard",
    to: "/",
    icon: Home,
  },
  {
    label: "Customization",
    to: "/customization",
    icon: Sliders,
  },
  {
    label: "Products",
    to: "/products",
    icon: Box,
  },
  {
    label: "Orders",
    to: "/orders",
    icon: ShoppingCart,
  },
  {
    label: "Menu",
    to: "/menu",
    icon: Sliders,
  },
  {
    label: "Coupons",
    to: "/coupons",
    icon: Tag,
  },
  {
    label: "Support",
    to: "/support",
    icon: MessageCircleQuestionIcon,
  },
];
