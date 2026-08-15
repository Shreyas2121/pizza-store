import { Footer, Navbar, SupportAction } from "@/components/main";
import { Outlet } from "react-router";

const MainLayout = () => {
  return (
    <>
      <Navbar />
      <SupportAction />
      <Outlet />
      <Footer />
    </>
  );
};

export default MainLayout;
