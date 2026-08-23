import { lazy } from "react";
import { Route } from "react-router";
import { AdminLayout, MainLayout, ProfileLayout } from "../layouts";
import { ProtectedRoutes } from "./guards/protected-route";
import { AdminProtectedRoute } from "./guards/admin-route";
import { NotFoundPage as NotFound } from "./not-found-page";


const Home = lazy(() => import("@/features/catalog").then((m) => ({ default: m.HomePage })));
const AdminProducts = lazy(() => import("@/features/catalog").then((m) => ({ default: m.AdminProductsPage })));
const AdminNewProduct = lazy(() => import("@/features/catalog").then((m) => ({ default: m.AdminNewProductPage })));
const AdminCustomization = lazy(() => import("@/features/catalog").then((m) => ({ default: m.AdminCustomizationsPage })));
const AdminMenu = lazy(() => import("@/features/catalog").then((m) => ({ default: m.AdminMenuPage })));

const Profile = lazy(() => import("@/features/account").then((m) => ({ default: m.ProfilePage })));
const Address = lazy(() => import("@/features/account").then((m) => ({ default: m.AddressesPage })));

const Cart = lazy(() => import("@/features/cart").then((m) => ({ default: m.CartPage })));
const Checkout = lazy(() => import("@/features/checkout").then((m) => ({ default: m.CheckoutPage })));

const Orders = lazy(() => import("@/features/orders").then((m) => ({ default: m.CustomerOrdersPage })));
const OrderDetails = lazy(() => import("@/features/orders").then((m) => ({ default: m.CustomerOrderDetailsPage })));
const AdminOrders = lazy(() => import("@/features/orders").then((m) => ({ default: m.AdminOrdersPage })));
const AdminOrderDetails = lazy(() => import("@/features/orders").then((m) => ({ default: m.AdminOrderDetailsPage })));

const AdminSupport = lazy(() => import("@/features/support").then((m) => ({ default: m.AdminSupportPage })));
const AdminChat = lazy(() => import("@/features/support").then((m) => ({ default: m.AdminChatPage })));

const AdminHome = lazy(() => import("@/features/admin-dashboard").then((m) => ({ default: m.AdminDashboardPage })));
const AdminStores = lazy(() => import("@/features/store").then((m) => ({ default: m.AdminStoresPage })));
const AdminStoreProducts = lazy(() => import("@/features/store").then((m) => ({ default: m.AdminStoreProductsPage })));
const AdminStoreDeliveryZones = lazy(() => import("@/features/store").then((m) => ({ default: m.AdminStoreDeliveryZonesPage })));

export const AppRoutes = () => (
  <>
    <Route element={<MainLayout />}>
      <Route path="/" element={<Home />} />
      <Route
        path="/cart"
        element={
          <ProtectedRoutes>
            <Cart />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/checkout"
        element={
          <ProtectedRoutes>
            <Checkout />
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
      <Route path="/admin/stores" element={<AdminStores />} />
      <Route path="/admin/stores/:id/products" element={<AdminStoreProducts />} />
      <Route path="/admin/stores/:id/delivery-zones" element={<AdminStoreDeliveryZones />} />
      <Route path="/admin/order/:id" element={<AdminOrderDetails />} />
      <Route path="/admin/support" element={<AdminSupport />} />
      <Route path="/admin/support/:id" element={<AdminChat />} />
    </Route>

    {/* Catch-all 404 Route */}
    <Route path="*" element={<NotFound />} />
  </>
);
