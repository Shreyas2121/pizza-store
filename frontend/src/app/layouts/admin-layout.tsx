import { Suspense, useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Menu as AccountMenu, Select, UnstyledButton } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, Menu, Store } from "lucide-react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { AdminSidebar } from "@/features/admin-navigation";
import { useUser } from "@/features/auth";
import {
  isPlatformAdmin,
  useSyncStaffStore,
} from "@/features/access";
import { useAdminStores } from "@/features/store";
import { useSocketStore } from "@/features/support";
import { RouteSkeleton } from "@/shared/ui";

const pageNames: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/products": "Products",
  "/admin/product/new": "New product",
  "/admin/customization": "Customizations",
  "/admin/menu": "Menu management",
  "/admin/orders": "Orders",
  "/admin/stores": "Stores",
  "/admin/inventory": "Inventory",
  "/admin/system": "System maintenance",
  "/admin/support": "Support queue",
  "/admin/staff": "Store staff",
  "/admin/audit": "Audit history",
};

export const AdminLayout = () => {
  const { user, isLoggedIn, logout } = useUser();
  const { access, accessLoading, activeStoreId, setActiveStoreId } = useSyncStaffStore();
  const { socket } = useSocketStore();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpened, setMobileOpened] = useState(false);

  const { data: allAdminStores } = useAdminStores();

  const handleStoreChange = (newStoreIdStr: string | null) => {
    const nextStoreId = !newStoreIdStr || newStoreIdStr === "all" ? null : Number(newStoreIdStr);
    setActiveStoreId(nextStoreId);

    // Invalidate store-scoped queries to immediately switch data context cleanly
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["dash-home-cards"] });
    queryClient.invalidateQueries({ queryKey: ["dash-home-charts"] });
    queryClient.invalidateQueries({ queryKey: ["order-adminAll"] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: ["stores"] });
    queryClient.invalidateQueries({ queryKey: ["staff"] });
    queryClient.invalidateQueries({ queryKey: ["audit"] });
  };

  const title = useMemo(
    () =>
      pageNames[location.pathname] ??
      (location.pathname.includes("/order/")
        ? "Order details"
        : location.pathname.includes("/stores/")
        ? location.pathname.endsWith("/products") ? "Store products" : "Delivery zones"
        : location.pathname.includes("/support/")
        ? "Support conversation"
        : "Operations"),
    [location.pathname]
  );
  const initials = `${user?.fname?.[0] ?? ""}${user?.lname?.[0] ?? ""}`.toUpperCase();

  useEffect(() => setMobileOpened(false), [location.pathname]);

  useEffect(() => {
    if (!socket) return;

    const handleChatRequest = () => {
      if (isPlatformAdmin(access)) {
        showNotification({
          title: "New support request",
          message: "A customer is waiting for help.",
          color: "brand",
          autoClose: 8000,
          onClick: () => navigate("/admin/support"),
        });
      }
    };

    const handleLowStock = (alert: {
      storeId: number;
      storeName?: string;
      productId: number;
      productName: string;
      currentQuantity: number;
      threshold: number;
      severity: "low_stock" | "out_of_stock";
    }) => {
      const isOutOfStock =
        alert.severity === "out_of_stock" || alert.currentQuantity === 0;
      showNotification({
        title: isOutOfStock ? "Out of stock alert" : "Low stock alert",
        message: isOutOfStock
          ? `${alert.productName} is now out of stock${
              alert.storeName ? ` at ${alert.storeName}` : ""
            }.`
          : `${alert.productName} has only ${alert.currentQuantity} left in stock (threshold: ${
              alert.threshold
            })${alert.storeName ? ` at ${alert.storeName}` : ""}.`,
        color: isOutOfStock ? "red" : "yellow",
        autoClose: 8000,
        onClick: () => navigate(`/admin/inventory?status=${alert.severity}`),
      });
    };

    socket.on("chatRequest", handleChatRequest);
    socket.on("lowStock", handleLowStock);
    return () => {
      socket.off("chatRequest", handleChatRequest);
      socket.off("lowStock", handleLowStock);
    };
  }, [socket, navigate, access]);

  if (!isLoggedIn || !user) return <Navigate to="/" replace />;
  if (accessLoading) return <RouteSkeleton admin />;
  if (!isPlatformAdmin(access) && (access?.memberships.length ?? 0) === 0) {
    return <Navigate to="/" replace />;
  }

  const isAdmin = isPlatformAdmin(access);
  const memberships = access?.memberships ?? [];

  return (
    <div className="flex min-h-screen bg-[#F7F5F2] text-ink">
      <AdminSidebar
        collapsed={collapsed}
        mobileOpened={mobileOpened}
        onMobileClose={() => setMobileOpened(false)}
        onToggleCollapse={() => setCollapsed((value) => !value)}
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpened(true)}
              className="icon-button lg:hidden"
              aria-label="Open admin navigation"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <nav className="flex items-center gap-1.5 text-xs text-ink-muted" aria-label="Breadcrumb">
                <Link to="/admin" className="hover:text-brand">
                  Operations
                </Link>
                {title !== "Dashboard" && (
                  <>
                    <span>/</span>
                    <span className="truncate">{title}</span>
                  </>
                )}
              </nav>
              <p className="mt-0.5 truncate text-lg font-bold text-ink">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Store Switcher for Platform Admin or Multi-store Staff */}
            {isAdmin ? (
              <div className="hidden sm:block">
                <Select
                  size="xs"
                  aria-label="Select active store scope"
                  value={activeStoreId ? String(activeStoreId) : "all"}
                  onChange={handleStoreChange}
                  data={[
                    { value: "all", label: "🌐 All Stores (Global)" },
                    ...(allAdminStores ?? []).map((store) => ({
                      value: String(store.id),
                      label: `📍 ${store.name}`,
                    })),
                  ]}
                  className="min-w-44"
                />
              </div>
            ) : memberships.length > 1 ? (
              <div className="hidden sm:block">
                <Select
                  size="xs"
                  aria-label="Select active store scope"
                  value={activeStoreId ? String(activeStoreId) : null}
                  onChange={handleStoreChange}
                  data={memberships.map((m) => ({
                    value: String(m.store.id),
                    label: `📍 ${m.store.name} (${m.role})`,
                  }))}
                  className="min-w-48"
                />
              </div>
            ) : memberships.length === 1 ? (
              <div className="hidden sm:block">
                <Badge variant="light" color="brand" size="lg" radius="sm">
                  📍 {memberships[0].store.name}
                </Badge>
              </div>
            ) : null}

            {isAdmin && (
              <Link to="/admin/support" className="icon-button relative" aria-label="Open support queue">
                <Bell size={20} />
              </Link>
            )}

            <AccountMenu position="bottom-end" width={220} shadow="md">
              <AccountMenu.Target>
                <UnstyledButton
                  className="flex min-h-11 items-center gap-2 rounded-pill border border-border bg-surface py-1 pl-1 pr-3 hover:bg-surface-muted"
                  aria-label="Open admin account menu"
                >
                  <Avatar color="brand" radius="xl" size={34}>
                    {initials}
                  </Avatar>
                  <span className="hidden max-w-28 truncate text-sm font-semibold sm:block">{user.fname}</span>
                  <ChevronDown size={15} />
                </UnstyledButton>
              </AccountMenu.Target>
              <AccountMenu.Dropdown>
                <AccountMenu.Label>{user.email}</AccountMenu.Label>
                <AccountMenu.Item component={Link} to="/" leftSection={<Store size={17} />}>
                  View storefront
                </AccountMenu.Item>
                <AccountMenu.Divider />
                <AccountMenu.Item
                  color="red"
                  leftSection={<LogOut size={17} />}
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Log out
                </AccountMenu.Item>
              </AccountMenu.Dropdown>
            </AccountMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-admin p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<RouteSkeleton admin />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
