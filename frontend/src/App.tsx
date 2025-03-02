import { Outlet, Route, Routes, useNavigate } from "react-router";
import GlobalModal from "./components/common/global-modal";
import MainLayout from "./layouts/main-layout";
import Home from "./pages/main/home";

import ProfileLayout from "./layouts/profile-layout";
import Profile from "./pages/main/profile/profile";
import Address from "./pages/main/profile/address";
import Orders from "./pages/main/profile/orders";
import OrderDetails from "./pages/main/profile/order-details";
import { lazy, Suspense } from "react";
import { Loader } from "lucide-react";
import { useAuthModalStore } from "./store/modal";
import { useUser } from "./store/user";
import Login from "./components/auth/login";
import AdminLayout from "./layouts/admin-layout";

const Checkout = lazy(() => import("./pages/main/checkout"));
const Cart = lazy(() => import("./pages/main/cart"));

const AdminHome = lazy(() => import("./pages/admin/home"));
const AdminProductsA = lazy(() => import("./pages/admin/products"));
const AdminNewProduct = lazy(
  () => import("./pages/admin/products/new-product")
);
const AdminMenu = lazy(() => import("./pages/admin/menu"));
const AdminCustomization = lazy(() => import("./pages/admin/customization"));
const AdminOrdersA = lazy(() => import("./pages/admin/orders"));
const AdminOrderDetailsA = lazy(
  () => import("./pages/admin/orders/order-details")
);

function ProtectedRoutes() {
  const { openModal } = useAuthModalStore();
  const navigate = useNavigate();
  const { isLoggedIn } = useUser();

  if (!isLoggedIn) {
    openModal({
      content: <Login />,
      title: "",
    });
    navigate("/");
    return null;
  }

  return <Outlet />;
}

function App() {
  return (
    <>
      <GlobalModal />
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoutes />}>
            <Route
              path="/cart"
              element={
                <Suspense fallback={<Loader className="m-auto" />}>
                  <Cart />
                </Suspense>
              }
            />
            <Route element={<ProfileLayout />}>
              <Route path="/profile" element={<Profile />} />
              <Route path="/address" element={<Address />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/order/:id" element={<OrderDetails />} />
            </Route>
          </Route>
        </Route>
        <Route element={<ProtectedRoutes />}>
          <Route
            path="/checkout"
            element={
              <Suspense fallback={<Loader className="m-auto" />}>
                <Checkout />
              </Suspense>
            }
          />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="/admin/products" element={<AdminProductsA />} />
          <Route path="/admin/product/new" element={<AdminNewProduct />} />
          <Route path="/admin/customization" element={<AdminCustomization />} />

          <Route path="/admin/menu" element={<AdminMenu />} />

          <Route path="/admin/orders" element={<AdminOrdersA />} />
          <Route path="/admin/order/:id" element={<AdminOrderDetailsA />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
