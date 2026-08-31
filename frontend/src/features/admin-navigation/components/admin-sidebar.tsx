import { Avatar, Drawer, Tooltip } from "@mantine/core";
import { ChevronLeft, ChevronRight, LogOut, Pizza } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { sidebarLinks } from "../model/navigation.config";
import { useUser } from "@/features/auth";
import {
  getActiveMembershipRole,
  hasStorePermission,
  isPlatformAdmin,
  useAccessMe,
  useStaffActiveStore,
  type ActiveAccessRole,
} from "@/features/access";

type AdminSidebarProps = {
  collapsed: boolean;
  mobileOpened: boolean;
  onMobileClose: () => void;
  onToggleCollapse: () => void;
};

const roleDisplayNames: Record<ActiveAccessRole, string> = {
  admin: "Administrator",
  manager: "Store Manager",
  finance_manager: "Finance Manager",
  payroll_manager: "Payroll Manager",
  operator: "Store Operator",
  inventory_staff: "Inventory Staff",
};

export const AdminSidebar = ({
  collapsed,
  mobileOpened,
  onMobileClose,
  onToggleCollapse,
}: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const { data: access } = useAccessMe();
  const { activeStoreId } = useStaffActiveStore();

  const initials = `${user?.fname?.[0] ?? ""}${user?.lname?.[0] ?? ""}`.toUpperCase();
  const activeRole = getActiveMembershipRole(access, activeStoreId) ?? (user?.role === "admin" ? "admin" : null);
  const roleLabel = activeRole ? roleDisplayNames[activeRole] ?? "Staff" : "Staff";

  const activeFor = (to: string) =>
    to === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(to) ||
        (to === "/admin/products" && location.pathname.startsWith("/admin/product"));

  const visibleLinks = sidebarLinks.filter((link) => {
    if (link.platformOnly) {
      return isPlatformAdmin(access);
    }
    if (link.requiredPermission) {
      return hasStorePermission(access, activeStoreId, link.requiredPermission);
    }
    if (link.to === "/admin/stores") {
      return (
        isPlatformAdmin(access) ||
        hasStorePermission(access, activeStoreId, "store.profile.update") ||
        hasStorePermission(access, activeStoreId, "store.staff.read")
      );
    }
    return true;
  });

  const content = (compact: boolean) => (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-[72px] items-center border-b border-border ${
          compact ? "justify-center px-2" : "gap-3 px-5"
        }`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white">
          <Pizza size={21} />
        </span>
        {!compact && (
          <div>
            <p className="font-display text-xl leading-none text-ink">PizzaStore</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
              Operations workspace
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Admin navigation">
        {!compact && (
          <p className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-[0.15em] text-ink-muted">
            Workspace
          </p>
        )}
        <ul className="space-y-1">
          {visibleLinks.map(({ label, to, icon: Icon }) => {
            const active = activeFor(to);
            const link = (
              <NavLink
                to={to}
                end={to === "/admin"}
                onClick={onMobileClose}
                aria-label={compact ? label : undefined}
                className={`flex min-h-11 items-center rounded-control text-sm font-semibold transition-colors ${
                  compact ? "justify-center px-2" : "gap-3 px-3"
                } ${
                  active
                    ? "bg-brand text-white shadow-subtle"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                <Icon size={19} className="shrink-0" aria-hidden="true" />
                {!compact && <span>{label}</span>}
              </NavLink>
            );
            return (
              <li key={to}>
                {compact ? (
                  <Tooltip label={label} position="right" withArrow>
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <div
          className={`flex items-center ${
            compact ? "justify-center" : "gap-3 rounded-control bg-surface-muted p-3"
          }`}
        >
          <Avatar color="brand" radius="xl" size={compact ? 38 : 40}>
            {initials}
          </Avatar>
          {!compact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {user?.fname} {user?.lname}
              </p>
              <p className="truncate text-xs text-ink-muted">{roleLabel}</p>
            </div>
          )}
        </div>
        <Tooltip label="Log out" position="right" disabled={!compact}>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className={`mt-2 flex min-h-11 w-full items-center rounded-control text-sm font-semibold text-ink-muted hover:bg-red-50 hover:text-danger ${
              compact ? "justify-center" : "gap-3 px-3"
            }`}
            aria-label={compact ? "Log out" : undefined}
          >
            <LogOut size={18} />
            {!compact && "Log out"}
          </button>
        </Tooltip>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 border-r border-border bg-surface transition-[width] duration-200 lg:block ${
          collapsed ? "w-[84px]" : "w-64"
        }`}
      >
        {content(collapsed)}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3 top-24 grid h-7 w-7 place-items-center rounded-full border border-border bg-surface text-ink-muted shadow-subtle hover:text-brand"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </aside>
      <Drawer
        opened={mobileOpened}
        onClose={onMobileClose}
        position="left"
        size={280}
        padding={0}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        classNames={{ body: "h-full" }}
      >
        {content(false)}
      </Drawer>
    </>
  );
};

export default AdminSidebar;
