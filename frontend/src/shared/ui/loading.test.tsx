import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider, Button, Loader } from "@mantine/core";
import { MemoryRouter } from "react-router";
import { readFileSync } from "node:fs";
import { theme } from "../config/theme";
import { LoadingRegion, RefreshIndicator, RouteSkeleton, PanelSkeleton, TableSkeleton } from "./skeletons";
import { routeLoadingLayout } from "./route-loading";
import type { ReactNode } from "react";

const render = (children: ReactNode, path = "/") => renderToStaticMarkup(
  <MantineProvider theme={theme} env="test"><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></MantineProvider>,
);

describe("shared loading behavior", () => {
  it("announces loading while hiding decorative placeholders from assistive technology", () => {
    const html = render(<LoadingRegion label="Loading receipts"><span>Decorative placeholder</span></LoadingRegion>);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('<span class="sr-only">Loading receipts</span>');
    expect(html).toContain('<div aria-hidden="true"><span>Decorative placeholder</span></div>');
  });

  it("uses dots for actions and compact field indicators through the application theme", () => {
    const html = render(<><Button loading>Save</Button><Loader size={16} /></>);
    expect(html).toBe(render(<><Button loading loaderProps={{ type: "dots" }}>Save</Button><Loader type="dots" size={16} /></>));
    expect(html).not.toBe(render(<><Button loading loaderProps={{ type: "oval" }}>Save</Button><Loader type="oval" size={16} /></>));
  });

  it("announces background refresh only while active and keeps content in place", () => {
    expect(render(<RefreshIndicator active={false} />)).not.toContain('role="status"');
    const html = render(<><RefreshIndicator active label="Refreshing orders" /><p>Order #42</p></>);
    expect(html).toContain("Refreshing orders");
    expect(html).toContain("Order #42");
    expect(html).not.toContain("mantine-Skeleton");
  });

  it("lets nested panels omit table controls and labels their own content", () => {
    const html = render(<TableSkeleton toolbar={false} rows={3} label="Loading refunds" />);
    expect(html).toContain("Loading refunds");
    expect(html).not.toContain("min(320px");
    expect(render(<PanelSkeleton form label="Loading bundle editor" />)).toContain("Loading bundle editor");
  });
});

const routesSource = readFileSync(new URL("../../app/router/routes.tsx", import.meta.url), "utf8");
const routes = [...new Set([...routesSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]))]
  .filter((path) => path.startsWith("/")).map((path) => path.replace(/:id/g, "42").replace(/:slug/g, "downtown"));

describe("route loading fallbacks", () => {
  it.each(routes)("renders an accessible skeleton for %s", (path) => {
    const html = render(<RouteSkeleton admin={path.startsWith("/admin")} />, path);
    expect(html).toContain('role="status"');
    expect(html).toContain("mantine-Skeleton");
    expect(html).not.toContain("mantine-Loader");
  });

  it.each([
    ["/", "products"], ["/offers/42/products", "products"], ["/cart", "cart"], ["/checkout", "checkout"],
    ["/orders", "list"], ["/order/42", "details"], ["/address", "cards"],
    ["/admin/categories", "cards"], ["/admin/bundles/42", "form"],
    ["/admin/payroll", "table"], ["/admin/finance", "report"],
    ["/docs/architecture", "form"], ["/admin/support/42", "chat"],
  ])("matches %s to its destination layout", (path, layout) => {
    expect(routeLoadingLayout(path)).toBe(layout);
  });

  it("does not add a second page shell inside account or admin layouts", () => {
    expect(render(<RouteSkeleton contained />, "/orders")).not.toContain("page-shell");
    expect(render(<RouteSkeleton admin />, "/admin/payroll")).not.toContain("page-shell");
  });
});
