import { Outlet, Route, Routes, useNavigate } from "react-router";
import GlobalModal from "./components/global-modal";
import MainLayout from "./layouts/main-layout";
import Home from "./pages/home";

import ProfileLayout from "./layouts/profile-layout";
import Profile from "./pages/profile/profile";
import Address from "./pages/profile/address";
import Orders from "./pages/profile/orders";
import OrderDetails from "./pages/profile/order-details";
import { lazy, Suspense } from "react";
import { Loader } from "lucide-react";
import { useAuthModalStore } from "./store/modal";
import { useUser } from "./store/user";
import Login from "./components/auth/login";

const Checkout = lazy(() => import("./pages/checkout"));
const Cart = lazy(() => import("./pages/cart"));

function ProtectedRoutes() {
  const { openModal } = useAuthModalStore();
  const navigate = useNavigate();
  const { isLoggedIn } = useUser();

  if (!isLoggedIn) {
    openModal(<Login />);
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
      </Routes>
    </>
  );
}

export default App;
