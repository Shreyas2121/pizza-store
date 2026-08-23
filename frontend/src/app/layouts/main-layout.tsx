import { StorefrontFooter } from "./components/storefront-footer";
import { StorefrontNavbar } from "./components/storefront-navbar";
import { SupportAction } from "@/features/support";
import { Outlet } from "react-router";
import { Suspense } from "react";
import { RouteSkeleton } from "@/shared/ui";
import { StoreContext } from "@/features/store";

export const MainLayout = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-control bg-ink px-4 py-3 font-semibold text-white transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <StorefrontNavbar />
      <StoreContext />
      <SupportAction />
      <main id="main-content" className="flex-1">
        <Suspense fallback={<RouteSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <StorefrontFooter />
    </div>
  );
};

export default MainLayout;
