import { Navigate, Route } from "react-router";
import { Login, useUser } from "@/features/auth";
import { useAuthModalStore } from "@/shared/model";
import { AdminLayout, MainLayout, ProfileLayout } from "./layouts";
import { ProfilePage as Profile, AddressesPage as Address } from "@/features/account";
import {
  HomePage as Home,
  AdminProductsPage as AdminProducts,
  AdminNewProductPage as AdminNewProduct,
  AdminCustomizationsPage as AdminCustomization,
  AdminMenuPage as AdminMenu,
} from "@/features/catalog";
import {
  Cart,
  Checkout,
  OrderDetails,
  Orders,
  NotFound,
} from "./pages/main";
import { Suspense, useEffect } from "react";
import { Loader } from "@mantine/core";
import {
  AdminChat,
  AdminHome,
  AdminOrderDetails,
  AdminOrders,
  AdminSupport,
} from "./pages/admin";

function ProtectedRoutes({ children }: { children: React.ReactNode }) {
  const { openModal } = useAuthModalStore();
  const { isLoggedIn } = useUser();

  useEffect(() => {
    if (!isLoggedIn) {
      openModal({ content: <Login />, title: "", options: { size: 440, padding: "lg", radius: "lg" } });
    }
  }, [isLoggedIn, openModal]);

  if (!isLoggedIn) {
    return null;
  }

  return <>{children}</>;
}

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn } = useUser();

  if (!isLoggedIn || user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export const AppRoutes = () => (
  <>
    <Route element={<MainLayout />}>
      <Route path="/" element={<Home />} />
      <Route
        path="/cart"
        element={
          <ProtectedRoutes>
            <Suspense fallback={<Loader className="m-auto" />}>
              <Cart />
            </Suspense>
          </ProtectedRoutes>
        }
      />
      <Route
        path="/checkout"
        element={
          <ProtectedRoutes>
            <Suspense fallback={<Loader className="m-auto" />}>
              <Checkout />
            </Suspense>
          </ProtectedRoutes>
        }
      />
      <Route
        element={
          <ProtectedRoutes>
            <ProfileLayout />
          </ProtectedRoutes>
        }
      >
        <Route path="/profile" element={<Profile />} />
        <Route path="/address" element={<Address />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/order/:id" element={<OrderDetails />} />
      </Route>
    </Route>

    {/* Admin Routes */}
    <Route
      path="/admin"
      element={
        <AdminProtectedRoute>
          <AdminLayout />
        </AdminProtectedRoute>
      }
    >
      <Route index element={<AdminHome />} />
      <Route path="/admin/products" element={<AdminProducts />} />
      <Route path="/admin/product/new" element={<AdminNewProduct />} />
      <Route path="/admin/customization" element={<AdminCustomization />} />
      <Route path="/admin/menu" element={<AdminMenu />} />
      <Route path="/admin/orders" element={<AdminOrders />} />
      <Route path="/admin/order/:id" element={<AdminOrderDetails />} />
      <Route path="/admin/support" element={<AdminSupport />} />
      <Route path="/admin/support/:id" element={<AdminChat />} />
    </Route>

    {/* Catch-all 404 Route */}
    <Route path="*" element={<NotFound />} />
  </>
);
