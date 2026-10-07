import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PromotionRoute } from "./promotion-route";
import { PromotionForm } from "./promotion-form";
import { PromotionDefinitionSummary } from "./promotion-definition-summary";
import { newPromotionDefinition } from "../model/promotion.helpers";
import type { Promotion } from "../model/promotion.types";
import type { UserAccessResponse } from "@/features/access";

const session = vi.hoisted(() => ({
  storeId: 10,
  access: { platformRole: "admin", memberships: [] } as UserAccessResponse,
}));
vi.mock("@/features/auth", () => ({
  useUser: () => ({ user: { id: 1 }, isLoggedIn: true }),
}));
vi.mock("@/features/access", () => ({
  isPlatformAdmin: (access: UserAccessResponse) =>
    access.platformRole === "admin",
  useAccessMe: () => ({
    data: session.access,
    isPending: false,
    isError: false,
  }),
  useStaffActiveStore: () => ({ activeStoreId: session.storeId }),
}));
vi.mock("@/shared/api", () => ({
  API: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

let client: QueryClient;
const render = (element: ReactElement) =>
  renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MantineProvider, { env: "test" }, element),
    ),
  );
beforeEach(() => {
  client = new QueryClient();
  session.access = { platformRole: "admin", memberships: [] };
  session.storeId = 10;
});
afterEach(() => client.clear());
const promotion = (): Promotion => ({
  ...newPromotionDefinition(),
  name: "Pizza Friday",
  description: "Friday pizzas",
  id: 7,
  definitionVersion: 2,
  status: "inactive",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  validity: {
    startsAt: "2026-10-01T00:00:00Z",
    endsAt: "2026-11-01T00:00:00Z",
    activeDaysOfWeek: [5],
    activeStartTime: "22:00",
    activeEndTime: "02:00",
  },
  display: {
    priority: 0,
    showOnHomepage: false,
    imageUrl: null,
    mobileImageUrl: null,
    imageAlt: null,
  },
});
describe("promotion route rendering boundaries", () => {
  it("renders definitions only for platform admins and denies their manager route", () => {
    expect(
      render(
        <PromotionRoute>
          <span>Private editor</span>
        </PromotionRoute>,
      ),
    ).toContain("Private editor");
    const denied = render(
      <PromotionRoute manager>
        <span>Store controls</span>
      </PromotionRoute>,
    );
    expect(denied).toContain("Permission denied");
    expect(denied).not.toContain("Store controls");
  });
  it("renders manager controls only for the selected membership and never the definition editor", () => {
    session.access = {
      platformRole: "user",
      memberships: [
        {
          membershipId: 1,
          role: "manager",
          store: { id: 10, name: "Main", slug: "main" },
          permissions: ["store.promotions.toggle"],
        },
      ],
    };
    expect(
      render(
        <PromotionRoute manager>
          <span>Store controls</span>
        </PromotionRoute>,
      ),
    ).toContain("Store controls");
    expect(
      render(
        <PromotionRoute>
          <span>Private editor</span>
        </PromotionRoute>,
      ),
    ).not.toContain("Private editor");
    session.storeId = 20;
    expect(
      render(
        <PromotionRoute manager>
          <span>Store controls</span>
        </PromotionRoute>,
      ),
    ).not.toContain("Store controls");
  });
});
describe("promotion form rendering", () => {
  it("labels UTC schedules, integer money/rates, nullable limits and placement prerequisites", () => {
    const html = render(
      <PromotionForm
        onCancel={() => {}}
        onSaved={() => {}}
        timezone="America/New_York"
      />,
    );
    for (const label of [
      "Starts at (UTC)",
      "Ends at (UTC, exclusive)",
      "Rate (basis points)",
      "Minimum order (paise)",
      "Global budget (paise)",
      "Leave blank for unlimited.",
      "America/New_York",
      "Show on homepage",
    ])
      expect(html).toContain(label);
    expect(html).toContain('type="submit"');
    const checkboxes = html.match(/<input[^>]+type="checkbox"[^>]*>/g) ?? [];
    expect(checkboxes.some((checkbox) => checkbox.includes("disabled"))).toBe(
      true,
    );
  });
  it("blocks stale saves while keeping the captured draft visible", () => {
    const html = render(
      <PromotionForm
        promotion={promotion()}
        latestVersion={3}
        onCancel={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(html).toContain("Pizza Friday");
    expect(html).toContain("Your draft is preserved");
    const submit = html.match(/<button[^>]+type="submit"[^>]*>/)?.[0];
    expect(submit).toContain("disabled");
    expect(html).toContain("Reload latest definition");
  });
  it("renders manager definition details without editable controls", () => {
    const html = render(
      <PromotionDefinitionSummary
        promotion={promotion()}
        timezone="Asia/Kolkata"
      />,
    );
    expect(html).toContain("Friday pizzas");
    expect(html).toContain("Asia/Kolkata");
    expect(html).toContain("Friday");
    expect(html).toContain("22:00–02:00");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
  });
});
