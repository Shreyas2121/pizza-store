export { HomePage } from "./pages/home-page";
export { AdminProductsPage } from "./pages/admin-products-page";
export { AdminNewProductPage } from "./pages/admin-new-product-page";
export { AdminMenuPage } from "./pages/admin-menu-page";
export { AdminCustomizationsPage } from "./pages/admin-customizations-page";

export { CustomizationDrawer } from "./components/customer/customization-drawer";
export { MenuCategoryRail } from "./components/customer/menu-category-rail";
export { ProductCard } from "./components/customer/product-card";
export { ProductGrid } from "./components/customer/product-grid";
export { BundleContents, BundlePrice } from "./components/customer/bundle-merchandising";

export { ProductAssignment } from "./components/admin/product-assignment";
export { MenuForm } from "./components/admin/menu-form";
export { ProductsCol } from "./components/admin/product-columns";
export { ProductForm } from "./components/admin/product-form";
export { ProductActions } from "./components/admin/product-actions";

export { useGetCategoriesSelect } from "./api/category.queries";
export {
  useGetAllCustomizations,
  useUpdateGroupMapping,
  useGetProductCustomization,
} from "./api/customization.queries";
export {
  useGetMenuItems,
  useCreateMenuItem,
  useCreateMenuMapping,
} from "./api/menu.queries";
export {
  useGetProducts,
  useGetProductsA,
  useCreateProduct,
  useGetProductByCat,
  useGetProductsByGroup,
} from "./api/product.queries";

export { productSchema, menuSchema, type TProduct, type TMenu } from "./model/catalog.schemas";
export type {
  Category,
  Product,
  BundleComponent,
  MenuItem,
  CustomizationGroup,
  CustomizationOption,
  Option,
  Group,
  ProductWithCategory,
  CustomizationType,
} from "./model/catalog.types";
export { catalogKeys } from "./model/catalog.keys";
