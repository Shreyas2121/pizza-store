import {
  Box,
  Home,
  MessageCircleQuestionIcon,
  ShoppingCart,
  Sliders,
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
