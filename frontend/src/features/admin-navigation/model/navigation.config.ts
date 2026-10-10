import {
  BadgePercent,
  Banknote,
  Box,
  CreditCard,
  Landmark,
  Layers,
  LayoutDashboard,
  LucideIcon,
  MessageCircleQuestion,
  PackageSearch,
  ScrollText,
  ShieldAlert,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tags,
  Users,
  UtensilsCrossed,
} from "lucide-react";

export interface SidebarLinkConfig {
  label: string;
  to: string;
  icon: LucideIcon;
  section: string;
  platformOnly?: boolean;
  managerOnly?: boolean;
  requiredPermission?: string;
}

export interface SidebarSectionConfig {
  title: string;
  links: SidebarLinkConfig[];
}

export const sidebarSections: SidebarSectionConfig[] = [
  {
    title: "Overview",
    links: [
      {
        label: "Dashboard",
        to: "/admin",
        icon: LayoutDashboard,
        section: "Overview",
      },
    ],
  },
  {
    title: "Operations",
    links: [
      {
        label: "Orders",
        to: "/admin/orders",
        icon: ShoppingCart,
        section: "Operations",
        requiredPermission: "orders.read",
      },
      {
        label: "Inventory",
        to: "/admin/inventory",
        icon: PackageSearch,
        section: "Operations",
        requiredPermission: "inventory.read",
      },
      {
        label: "Stores",
        to: "/admin/stores",
        icon: Store,
        section: "Operations",
      },
    ],
  },
  {
    title: "Catalog & Menu",
    links: [
      {
        label: "Products",
        to: "/admin/products",
        icon: Box,
        section: "Catalog & Menu",
        platformOnly: true,
      },
      {
        label: "Categories",
        to: "/admin/categories",
        icon: Layers,
        section: "Catalog & Menu",
        platformOnly: true,
      },
      {
        label: "Customization",
        to: "/admin/customization",
        icon: SlidersHorizontal,
        section: "Catalog & Menu",
        platformOnly: true,
      },
      {
        label: "Menu",
        to: "/admin/menu",
        icon: UtensilsCrossed,
        section: "Catalog & Menu",
        platformOnly: true,
      },
    ],
  },
  {
    title: "Marketing",
    links: [
      {
        label: "Promotions",
        to: "/admin/promotions",
        icon: BadgePercent,
        section: "Marketing",
        platformOnly: true,
      },
      {
        label: "Store promotions",
        to: "/admin/store-promotions",
        icon: Tags,
        section: "Marketing",
        managerOnly: true,
        requiredPermission: "store.promotions.toggle",
      },
    ],
  },
  {
    title: "Finance",
    links: [
      {
        label: "Payments",
        to: "/admin/payments",
        icon: CreditCard,
        section: "Finance",
        platformOnly: true,
      },
      {
        label: "Finance",
        to: "/admin/finance",
        icon: Landmark,
        section: "Finance",
        requiredPermission: "finance.refunds.create",
      },
      {
        label: "Payroll",
        to: "/admin/payroll",
        icon: Banknote,
        section: "Finance",
        requiredPermission: "payroll.read",
      },
    ],
  },
  {
    title: "Administration",
    links: [
      {
        label: "Staff",
        to: "/admin/staff",
        icon: Users,
        section: "Administration",
        requiredPermission: "store.staff.read",
      },
      {
        label: "Support",
        to: "/admin/support",
        icon: MessageCircleQuestion,
        section: "Administration",
        platformOnly: true,
      },
      {
        label: "Audit",
        to: "/admin/audit",
        icon: ScrollText,
        section: "Administration",
        requiredPermission: "store.audit.read",
      },
      {
        label: "System",
        to: "/admin/system",
        icon: ShieldAlert,
        section: "Administration",
        platformOnly: true,
      },
    ],
  },
];

export const sidebarLinks: SidebarLinkConfig[] = sidebarSections.flatMap(
  (section) => section.links,
);
