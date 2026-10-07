import { useEffect, useState } from "react";
import { Avatar, Button, Drawer, Menu as AccountMenu, Tooltip, UnstyledButton } from "@mantine/core";
import { ChevronDown, ClipboardList, LayoutDashboard, LogIn, LogOut, MapPin, Menu, Search, ShoppingCart, User } from "lucide-react";
import { Link, useLocation } from "react-router";
import { Login, useUser } from "@/features/auth";
import { useAuthModalStore } from "@/shared/model";
import { useGetCartCount } from "@/features/cart";
import { success } from "@/shared/lib";
import BrandLockup from "./brand-lockup";
import { useStoreStore } from "@/features/store";
import { isPlatformAdmin, useAccessMe } from "@/features/access";

const primaryLinks = [
  { label: "Menu", to: "/#menu" },
  { label: "Offers", to: "/offers" },
  { label: "Track order", to: "/orders" },
];

export function StorefrontNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isLoggedIn, logout, user } = useUser();
  const { openModal } = useAuthModalStore();
  const location = useLocation();
  const { data } = useGetCartCount(isLoggedIn);
  const { data: access } = useAccessMe();
  const cartCount = data ?? 0;
  const userPincode = useStoreStore((state) => state.userPincode);
  const openPincodeModal = useStoreStore((state) => state.openPincodeModal);
  const initials = user ? `${user.fname?.[0] ?? ""}${user.lname?.[0] ?? ""}`.toUpperCase() : "";
  const platformAdmin = isPlatformAdmin(access);
  const canAccessOperations = platformAdmin || (access?.memberships.length ?? 0) > 0;
  const operationsLabel = platformAdmin ? "Admin dashboard" : "Operations dashboard";

  useEffect(() => setMobileOpen(false), [location.pathname, location.search, location.hash]);

  const openLogin = () => {
    setMobileOpen(false);
    openModal({ content: <Login />, title: "", options: { size: 440, padding: "lg", radius: "lg" } });
  };

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    success("Logged out successfully");
  };

  const navLinkClass = "rounded-control px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 shadow-subtle backdrop-blur-md">
      <div className="bg-ink px-5 py-2 text-center text-xs font-medium tracking-wide text-surface sm:text-sm">
        Hand-stretched dough · Fresh ingredients · Cash on delivery
      </div>

      <nav className="mx-auto flex h-[72px] max-w-storefront items-center justify-between px-5 sm:px-8 lg:px-12" aria-label="Primary navigation">
        <BrandLockup />

        <div className="hidden items-center gap-1 lg:flex">
          {primaryLinks.map((link) => <Link key={link.label} to={link.to} className={navLinkClass}>{link.label}</Link>)}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Tooltip label={userPincode ? "Change delivery pincode" : "Set delivery pincode"}>
            <button
              type="button"
              onClick={openPincodeModal}
              className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-border bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline-none"
            >
              <MapPin size={18} className="text-brand" aria-hidden="true" />
              <span>{userPincode ?? "Set pincode"}</span>
            </button>
          </Tooltip>
          <Tooltip label="Find a pizza">
            <Link to="/#menu" className="icon-button" aria-label="Find a pizza in the menu"><Search size={20} /></Link>
          </Tooltip>

          {isLoggedIn ? (
            <>
              <Link to="/cart" className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-border bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline-none" aria-label={`Cart with ${cartCount} ${cartCount === 1 ? "item" : "items"}`}>
                <ShoppingCart size={19} aria-hidden="true" />
                <span>Cart</span>
                <span className="grid min-w-6 place-items-center rounded-pill bg-brand px-1.5 py-0.5 text-xs font-bold text-white">{cartCount}</span>
              </Link>

              <AccountMenu position="bottom-end" width={230} shadow="md">
                <AccountMenu.Target>
                  <UnstyledButton className="flex min-h-11 items-center gap-2 rounded-pill border border-border bg-surface py-1 pl-1 pr-3 text-ink transition-colors hover:bg-surface-muted" aria-label="Open account menu">
                    <Avatar color="brand" radius="xl" size={34}>{initials || <User size={18} />}</Avatar>
                    <span className="hidden max-w-28 truncate text-sm font-semibold xl:block">{user?.fname}</span>
                    <ChevronDown size={15} aria-hidden="true" />
                  </UnstyledButton>
                </AccountMenu.Target>
                <AccountMenu.Dropdown>
                  <AccountMenu.Label>
                    <span className="block truncate text-sm font-semibold text-ink">{user?.fname} {user?.lname}</span>
                    <span className="block truncate font-normal text-ink-muted">{user?.email}</span>
                  </AccountMenu.Label>
                  <AccountMenu.Item component={Link} to="/profile" leftSection={<User size={17} />}>Account</AccountMenu.Item>
                  <AccountMenu.Item component={Link} to="/orders" leftSection={<ClipboardList size={17} />}>Orders</AccountMenu.Item>
                  <AccountMenu.Item component={Link} to="/address" leftSection={<MapPin size={17} />}>Addresses</AccountMenu.Item>
                  {canAccessOperations && <AccountMenu.Item component={Link} to="/admin" leftSection={<LayoutDashboard size={17} />}>{operationsLabel}</AccountMenu.Item>}
                  <AccountMenu.Divider />
                  <AccountMenu.Item color="red" leftSection={<LogOut size={17} />} onClick={handleLogout}>Log out</AccountMenu.Item>
                </AccountMenu.Dropdown>
              </AccountMenu>
            </>
          ) : (
            <>
              <Button variant="subtle" color="dark" leftSection={<LogIn size={17} />} onClick={openLogin}>Sign in</Button>
              <Button component={Link} to="/#menu" size="md">Order now</Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          {isLoggedIn && (
            <Link to="/cart" className="relative icon-button" aria-label={`Cart with ${cartCount} ${cartCount === 1 ? "item" : "items"}`}>
              <ShoppingCart size={21} />
              {cartCount > 0 && <span className="absolute right-0 top-0 grid min-h-5 min-w-5 place-items-center rounded-pill bg-brand px-1 text-[10px] font-bold text-white">{cartCount > 99 ? "99+" : cartCount}</span>}
            </Link>
          )}
          <button type="button" className="icon-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" aria-expanded={mobileOpen}><Menu size={24} /></button>
        </div>
      </nav>

      <Drawer opened={mobileOpen} onClose={() => setMobileOpen(false)} position="right" size="100%" title={<BrandLockup onClick={() => setMobileOpen(false)} />} padding="lg" overlayProps={{ backgroundOpacity: 0.35, blur: 2 }} classNames={{ body: "flex h-[calc(100dvh-81px)] flex-col" }}>
        <div className="flex flex-1 flex-col">
          {isLoggedIn ? (
            <div className="mb-7 flex items-center gap-3 rounded-card bg-surface-muted p-4">
              <Avatar color="brand" radius="xl" size={44}>{initials}</Avatar>
              <div className="min-w-0"><p className="truncate font-semibold text-ink">{user?.fname} {user?.lname}</p><p className="truncate text-sm text-ink-muted">{user?.email}</p></div>
            </div>
          ) : (
            <div className="mb-7 rounded-card bg-brand-soft p-4">
              <p className="font-semibold text-ink">Your next pizza is a few taps away.</p>
              <button type="button" onClick={openLogin} className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-brand"><LogIn size={18} /> Sign in to your account</button>
            </div>
          )}

          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Discover</p>
          <button
            type="button"
            onClick={() => { openPincodeModal(); setMobileOpen(false); }}
            className="mb-3 flex min-h-12 items-center gap-3 rounded-control bg-brand-soft px-4 text-left font-semibold text-ink"
          >
            <MapPin size={19} className="text-brand" />
            <span>{userPincode ? `Delivering to ${userPincode}` : "Set delivery pincode"}</span>
          </button>
          <div className="flex flex-col">
            {primaryLinks.map((link) => <Link key={link.label} to={link.to} className="flex min-h-14 items-center border-b border-border text-lg font-semibold text-ink">{link.label}</Link>)}
          </div>

          {isLoggedIn && (
            <>
              <p className="mb-2 mt-8 text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Your account</p>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/profile" className="secondary-button min-h-12 gap-2"><User size={18} /> Account</Link>
                <Link to="/address" className="secondary-button min-h-12 gap-2"><MapPin size={18} /> Addresses</Link>
                {canAccessOperations && <Link to="/admin" className="secondary-button col-span-2 min-h-12 gap-2"><LayoutDashboard size={18} /> {operationsLabel}</Link>}
              </div>
            </>
          )}

          <div className="mt-auto border-t border-border pt-5">
            {isLoggedIn ? (
              <div className="space-y-3">
                <Link to="/cart" className="primary-button min-h-12 w-full gap-2"><ShoppingCart size={19} /> View cart · {cartCount} {cartCount === 1 ? "item" : "items"}</Link>
                <button type="button" onClick={handleLogout} className="tertiary-button min-h-11 w-full gap-2"><LogOut size={18} /> Log out</button>
              </div>
            ) : <Link to="/#menu" className="primary-button min-h-12 w-full">Order now</Link>}
          </div>
        </div>
      </Drawer>
    </header>
  );
}

export default StorefrontNavbar;
