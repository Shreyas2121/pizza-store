export type RouteLoadingLayout = "products" | "cart" | "checkout" | "profile" | "cards" | "list" | "details" | "form" | "report" | "table" | "chat";

/** Keep route fallbacks aligned with content, including permission checks. */
export function routeLoadingLayout(pathname: string): RouteLoadingLayout {
  if (pathname === "/" || /^\/offers\/[^/]+\/products\/?$/.test(pathname)) return "products";
  if (pathname === "/cart") return "cart";
  if (pathname === "/checkout") return "checkout";
  if (pathname === "/profile") return "profile";
  if (pathname === "/address" || pathname === "/offers" || pathname === "/admin/categories") return "cards";
  if (pathname === "/orders" || pathname === "/admin/customization" || pathname === "/admin/menu") return "list";
  if (/^\/(admin\/)?order\//.test(pathname) || /^\/stores\//.test(pathname)) return "details";
  if (pathname.startsWith("/docs") || pathname === "/admin/product/new" || pathname.startsWith("/admin/bundles/") || pathname === "/admin/payments" || pathname === "/admin/system" || pathname === "/staff-invitations/accept") return "form";
  if (pathname === "/admin" || pathname === "/admin/finance") return "report";
  if (pathname.startsWith("/admin/support/")) return "chat";
  return "table";
}
