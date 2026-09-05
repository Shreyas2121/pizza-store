import { lazy } from "react";
import { Route } from "react-router";
import { AdminLayout, MainLayout, ProfileLayout } from "../layouts";
import { ProtectedRoutes } from "./guards/protected-route";
import { StaffProtectedRoute } from "./guards/staff-route";
import { PlatformAdminProtectedRoute } from "./guards/platform-admin-route";
import { NotFoundPage as NotFound } from "./not-found-page";

const DocsLayout = lazy(() => import("@/features/docs/components/docs-layout"));
const DocsIndex = lazy(() => import("@/features/docs/pages/docs-index-page"));
const DocsArchitecture = lazy(() => import("@/features/docs/pages/architecture-page"));
const DocsOrderLifecycle = lazy(() => import("@/features/docs/pages/order-lifecycle-page"));
const DocsNotFound = lazy(() => import("@/features/docs/pages/docs-not-found-page"));

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
const AdminInventory = lazy(() => import("@/features/inventory").then((m) => ({ default: m.AdminInventoryPage })));
const AdminSystem = lazy(() => import("@/features/system-maintenance").then((m) => ({ default: m.AdminSystemPage })));
const AdminStores = lazy(() => import("@/features/store").then((m) => ({ default: m.AdminStoresPage })));
const AdminStoreProducts = lazy(() => import("@/features/store").then((m) => ({ default: m.AdminStoreProductsPage })));
const AdminStoreDeliveryZones = lazy(() => import("@/features/store").then((m) => ({ default: m.AdminStoreDeliveryZonesPage })));
const AdminStaff = lazy(() => import("@/features/staff").then((m) => ({ default: m.AdminStaffPage })));
const AcceptStaffInvitation = lazy(() => import("@/features/staff").then((m) => ({ default: m.AcceptStaffInvitationPage })));
const AdminAudit = lazy(() => import("@/features/audit").then((m) => ({ default: m.AdminAuditPage })));

export const AppRoutes = () => (
  <>
    <Route path="/docs" element={<DocsLayout />}>
      <Route index element={<DocsIndex />} />
      <Route path="architecture" element={<DocsArchitecture />} />
      <Route path="order-lifecycle" element={<DocsOrderLifecycle />} />
      <Route path="*" element={<DocsNotFound />} />
    </Route>
    <Route element={<MainLayout />}>
      <Route path="/" element={<Home />} />
      <Route path="/staff-invitations/accept" element={<AcceptStaffInvitation />} />
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
        <StaffProtectedRoute>
          <AdminLayout />
        </StaffProtectedRoute>
      }
    >
      <Route index element={<AdminHome />} />
      <Route
        path="/admin/products"
        element={
          <PlatformAdminProtectedRoute>
            <AdminProducts />
          </PlatformAdminProtectedRoute>
        }
      />
      <Route
        path="/admin/product/new"
        element={
          <PlatformAdminProtectedRoute>
            <AdminNewProduct />
          </PlatformAdminProtectedRoute>
        }
      />
      <Route
        path="/admin/customization"
        element={
          <PlatformAdminProtectedRoute>
            <AdminCustomization />
          </PlatformAdminProtectedRoute>
        }
      />
      <Route
        path="/admin/menu"
        element={
          <PlatformAdminProtectedRoute>
            <AdminMenu />
          </PlatformAdminProtectedRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <StaffProtectedRoute requiredPermission="orders.read">
            <AdminOrders />
          </StaffProtectedRoute>
        }
      />
      <Route
        path="/admin/inventory"
        element={
          <StaffProtectedRoute requiredPermission="inventory.read">
            <AdminInventory />
          </StaffProtectedRoute>
        }
      />
      <Route
        path="/admin/system"
        element={
          <PlatformAdminProtectedRoute>
            <AdminSystem />
          </PlatformAdminProtectedRoute>
        }
      />
      <Route path="/admin/stores" element={<AdminStores />} />
      <Route path="/admin/stores/:id/products" element={<AdminStoreProducts />} />
      <Route path="/admin/stores/:id/delivery-zones" element={<AdminStoreDeliveryZones />} />
      <Route
        path="/admin/staff"
        element={
          <StaffProtectedRoute requiredPermission="store.staff.read">
            <AdminStaff />
          </StaffProtectedRoute>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <StaffProtectedRoute requiredPermission="store.audit.read">
            <AdminAudit />
          </StaffProtectedRoute>
        }
      />
      <Route
        path="/admin/order/:id"
        element={
          <StaffProtectedRoute requiredPermission="orders.read">
            <AdminOrderDetails />
          </StaffProtectedRoute>
        }
      />
      <Route
        path="/admin/support"
        element={
          <PlatformAdminProtectedRoute>
            <AdminSupport />
          </PlatformAdminProtectedRoute>
        }
      />
      <Route
        path="/admin/support/:id"
        element={
          <PlatformAdminProtectedRoute>
            <AdminChat />
          </PlatformAdminProtectedRoute>
        }
      />
    </Route>

    {/* Catch-all 404 Route */}
    <Route path="*" element={<NotFound />} />
  </>
);
