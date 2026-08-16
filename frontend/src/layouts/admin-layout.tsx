import { Suspense, useEffect, useMemo, useState } from "react";
import { Avatar, Menu as AccountMenu, Skeleton, UnstyledButton } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { Bell, ChevronDown, LogOut, Menu, Store } from "lucide-react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import "@mantine/charts/styles.css";
import AdminSidebar from "@/components/admin/sidebar";
import { useSocketStore, useUser } from "@/store";

const pageNames: Record<string, string> = {
  "/admin": "Dashboard", "/admin/products": "Products", "/admin/product/new": "New product", "/admin/customization": "Customizations", "/admin/menu": "Menu management", "/admin/orders": "Orders", "/admin/support": "Support queue",
};

const AdminLayout = () => {
  const { user, isLoggedIn, logout } = useUser();
  const { socket } = useSocketStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpened, setMobileOpened] = useState(false);

  const title = useMemo(() => pageNames[location.pathname] ?? (location.pathname.includes("/order/") ? "Order details" : location.pathname.includes("/support/") ? "Support conversation" : "Admin"), [location.pathname]);
  const initials = `${user?.fname?.[0] ?? ""}${user?.lname?.[0] ?? ""}`.toUpperCase();

  useEffect(() => setMobileOpened(false), [location.pathname]);
  useEffect(() => {
    if (!socket) return;
    const handleChatRequest = () => showNotification({ title: "New support request", message: "A customer is waiting for help.", color: "brand", autoClose: 8000, onClick: () => navigate("/admin/support") });
    socket.on("chatRequest", handleChatRequest);
    return () => { socket.off("chatRequest", handleChatRequest); };
  }, [socket, navigate]);

  if (!isLoggedIn || user?.role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen bg-[#F7F5F2] text-ink">
      <AdminSidebar collapsed={collapsed} mobileOpened={mobileOpened} onMobileClose={() => setMobileOpened(false)} onToggleCollapse={() => setCollapsed((value) => !value)} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpened(true)} className="icon-button lg:hidden" aria-label="Open admin navigation"><Menu size={22} /></button>
            <div className="min-w-0"><nav className="flex items-center gap-1.5 text-xs text-ink-muted" aria-label="Breadcrumb"><Link to="/admin" className="hover:text-brand">Admin</Link>{title !== "Dashboard" && <><span>/</span><span className="truncate">{title}</span></>}</nav><p className="mt-0.5 truncate text-lg font-bold text-ink">{title}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/support" className="icon-button relative" aria-label="Open support queue"><Bell size={20} /></Link>
            <AccountMenu position="bottom-end" width={220} shadow="md">
              <AccountMenu.Target><UnstyledButton className="flex min-h-11 items-center gap-2 rounded-pill border border-border bg-surface py-1 pl-1 pr-3 hover:bg-surface-muted" aria-label="Open admin account menu"><Avatar color="brand" radius="xl" size={34}>{initials}</Avatar><span className="hidden max-w-28 truncate text-sm font-semibold sm:block">{user.fname}</span><ChevronDown size={15} /></UnstyledButton></AccountMenu.Target>
              <AccountMenu.Dropdown><AccountMenu.Label>{user.email}</AccountMenu.Label><AccountMenu.Item component={Link} to="/" leftSection={<Store size={17} />}>View storefront</AccountMenu.Item><AccountMenu.Divider /><AccountMenu.Item color="red" leftSection={<LogOut size={17} />} onClick={() => { logout(); navigate("/"); }}>Log out</AccountMenu.Item></AccountMenu.Dropdown>
            </AccountMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-admin p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<div className="space-y-5"><Skeleton height={80} radius="lg" /><Skeleton height={320} radius="lg" /></div>}><Outlet /></Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
