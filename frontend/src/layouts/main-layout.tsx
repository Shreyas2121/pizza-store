import { Outlet } from "react-router";
import Navbar from "../components/main/navbar";
import Footer from "../components/main/footer";

const MainLayout = () => {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
};

export default MainLayout;
