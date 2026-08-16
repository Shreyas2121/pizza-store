import { Footer, Navbar } from "@/components/main";
import { SupportAction } from "@/features/support";
import { Outlet } from "react-router";

export const MainLayout = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-control bg-ink px-4 py-3 font-semibold text-white transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <Navbar />
      <SupportAction />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
