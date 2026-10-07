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
  WalletCards,
  Tags,
} from "lucide-react";

export interface SidebarLinkConfig {
  label: string;
  to: string;
  icon: LucideIcon;
  platformOnly?: boolean;
  managerOnly?: boolean;
  requiredPermission?: string;
}

export const sidebarLinks: SidebarLinkConfig[] = [
  { label: "Payments", to: "/admin/payments", icon: WalletCards, platformOnly: true },
  { label: "Categories", to: "/admin/categories", icon: Tags, platformOnly: true },
  { label: "Promotions", to: "/admin/promotions", icon: Tags, platformOnly: true },
  { label: "Store promotions", to: "/admin/store-promotions", icon: Tags, managerOnly: true, requiredPermission: "store.promotions.toggle" },
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
    label: "Payroll",
    to: "/admin/payroll",
    icon: WalletCards,
    requiredPermission: "payroll.read",
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
