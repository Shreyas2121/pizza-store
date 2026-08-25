import {
  Box,
  Home,
  MessageCircleQuestionIcon,
  PackageSearch,
  ShoppingCart,
  ShieldAlert,
  Sliders,
  Store,
} from "lucide-react";

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
    label: "Stores",
    to: "/admin/stores",
    icon: Store,
  },
  {
    label: "Inventory",
    to: "/admin/inventory",
    icon: PackageSearch,
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
  {
    label: "System",
    to: "/admin/system",
    icon: ShieldAlert,
  },
];
