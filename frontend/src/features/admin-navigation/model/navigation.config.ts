import {
  Box,
  Home,
  LucideIcon,
  MessageCircleQuestionIcon,
  PackageSearch,
  ShoppingCart,
  ShieldAlert,
  Sliders,
  Store,
  ScrollText,
  Users,
  Landmark,
} from "lucide-react";

export interface SidebarLinkConfig {
  label: string;
  to: string;
  icon: LucideIcon;
  platformOnly?: boolean;
  requiredPermission?: string;
}

export const sidebarLinks: SidebarLinkConfig[] = [
  {
    label: "Dashboard",
    to: "/admin",
    icon: Home,
  },
  {
    label: "Customization",
    to: "/admin/customization",
    icon: Sliders,
    platformOnly: true,
  },
  {
    label: "Products",
    to: "/admin/products",
    icon: Box,
    platformOnly: true,
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
    requiredPermission: "inventory.read",
  },
  {
    label: "Orders",
    to: "/admin/orders",
    icon: ShoppingCart,
    requiredPermission: "orders.read",
  },
  {
    label: "Finance",
    to: "/admin/finance",
    icon: Landmark,
    requiredPermission: "finance.refunds.create",
  },
  {
    label: "Staff",
    to: "/admin/staff",
    icon: Users,
    requiredPermission: "store.staff.read",
  },
  {
    label: "Audit",
    to: "/admin/audit",
    icon: ScrollText,
    requiredPermission: "store.audit.read",
  },
  {
    label: "Menu",
    to: "/admin/menu",
    icon: Sliders,
    platformOnly: true,
  },
  {
    label: "Support",
    to: "/admin/support",
    icon: MessageCircleQuestionIcon,
    platformOnly: true,
  },
  {
    label: "System",
    to: "/admin/system",
    icon: ShieldAlert,
    platformOnly: true,
  },
];
