import { Route } from "react-router";
import { AdminLayout, MainLayout, ProfileLayout } from "../layouts";
import { ProtectedRoutes } from "./guards/protected-route";
import { AdminProtectedRoute } from "./guards/admin-route";
import { ProfilePage as Profile, AddressesPage as Address } from "@/features/account";
import {
  HomePage as Home,
  AdminProductsPage as AdminProducts,
  AdminNewProductPage as AdminNewProduct,
  AdminCustomizationsPage as AdminCustomization,
  AdminMenuPage as AdminMenu,
} from "@/features/catalog";
import { CartPage as Cart } from "@/features/cart";
import { CheckoutPage as Checkout } from "@/features/checkout";
import {
  CustomerOrdersPage as Orders,
  CustomerOrderDetailsPage as OrderDetails,
  AdminOrdersPage as AdminOrders,
  AdminOrderDetailsPage as AdminOrderDetails,
} from "@/features/orders";
import {
  AdminSupportPage as AdminSupport,
  AdminChatPage as AdminChat,
} from "@/features/support";
import { AdminDashboardPage as AdminHome } from "@/features/admin-dashboard";
import { NotFound } from "@/pages/main";
import { Suspense } from "react";
import { Loader } from "@mantine/core";

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
