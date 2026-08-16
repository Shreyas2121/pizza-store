import { MantineColorsTuple } from "@mantine/core";
import {
  Box,
  Home,
  MapPin,
  ShoppingCart,
  Sliders,
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
    value: "delievered",
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

export const brandColor: MantineColorsTuple = [
  "#FDF2F0",
  "#F9E4DE",
  "#F3C5BA",
  "#E99D8F",
  "#DD6E5D",
  "#D44A37",
  "#C83E2B",
  "#A92F20",
  "#872316",
  "#64180D",
];

export const basilColor: MantineColorsTuple = [
  "#F2F8F4",
  "#E4F0E7",
  "#C3DEC9",
  "#9BC3A4",
  "#6F9E7B",
  "#4D835B",
  "#39734E",
  "#2D5C3E",
  "#21442E",
  "#162E1F",
];

// Alias for backwards compatibility with existing Mantine components using myColor
export const myColor = brandColor;

export const designTokens = {
  canvas: "#F8F4EC",
  surface: "#FFFDF8",
  surfaceMuted: "#F1EADF",
  ink: "#201A17",
  inkMuted: "#6F665F",
  border: "#E5DACE",
  brand: "#C83E2B",
  brandHover: "#A92F20",
  brandSoft: "#F9E4DE",
  basil: "#39734E",
  basilSoft: "#E4F0E7",
  gold: "#D69A2D",
  danger: "#B42318",
};

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
  { label: "Account overview", to: "/profile", icon: User },
  { label: "Saved addresses", to: "/address", icon: MapPin },
  { label: "Orders", to: "/orders", icon: Box },
];

export const sidebarLinks = [
  {
    label: "Dashboard",
    to: "/admin",
    icon: Home,
  },
  {
    label: "Customization",
    to: "/admin/customization",
    icon: Sliders,
  },
  {
    label: "Products",
    to: "/admin/products",
    icon: Box,
  },
  {
    label: "Orders",
    to: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    label: "Menu",
    to: "/admin/menu",
    icon: Sliders,
  },
  {
    label: "Support",
    to: "/admin/support",
    icon: MessageCircleQuestionIcon,
  },
];
