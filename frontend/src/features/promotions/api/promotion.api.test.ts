import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import {
  usePromotion,
  usePromotions,
  useStorePromotions,
} from "./promotion.queries";
import { usePromotionMutations } from "./promotion.mutations";
import { promotionKeys } from "../model/promotion.keys";
import { newPromotionDefinition } from "../model/promotion.helpers";
import type { UserAccessResponse } from "@/features/access";

const session = vi.hoisted(() => ({
  userId: 1,
  storeId: 10,
  access: { platformRole: "admin", memberships: [] } as UserAccessResponse,
}));
vi.mock("@/features/auth", () => ({
  useUser: () => ({ user: { id: session.userId }, isLoggedIn: true }),
}));
vi.mock("@/features/access", () => ({
  isPlatformAdmin: (access: UserAccessResponse) =>
    access.platformRole === "admin",
  useAccessMe: () => ({ data: session.access, isError: false }),
  useStaffActiveStore: () => ({ activeStoreId: session.storeId }),
}));
vi.mock("@/shared/api", () => ({
  API: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

let client: QueryClient;
const filters = { page: 1, pageSize: 25 };
const renderHook = <T>(hook: () => T): T => {
  let result: T | undefined;
  const Harness = () => {
    result = hook();
    return null;
  };
  renderToString(
    createElement(QueryClientProvider, { client }, createElement(Harness)),
  );
  if (result === undefined) throw new Error("Hook did not render");
  return result;
};
const definition = () => ({
  ...newPromotionDefinition(),
  name: "Offer",
  description: "Weekday offer",
  validity: {
    startsAt: "2026-10-01T00:00:00Z",
    endsAt: "2026-11-01T00:00:00Z",
    activeDaysOfWeek: null,
    activeStartTime: null,
    activeEndTime: null,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  session.access = { platformRole: "admin", memberships: [] };
  session.userId = 1;
  session.storeId = 10;
});
afterEach(() => client.clear());

describe("promotion query transport", () => {
  it("includes filters in both the URL parameters and private cache identity", async () => {
    vi.mocked(API.get).mockResolvedValue({
      data: { data: { items: [], ...filters, totalItems: 0, totalPages: 0 } },
    });
    const selected = {
      ...filters,
      kind: "coupon" as const,
      status: "scheduled" as const,
      storeId: 10,
    };
    await renderHook(() => usePromotions(selected)).refetch();
    expect(API.get).toHaveBeenCalledWith("/promotions", {
      params: selected,
      signal: expect.any(AbortSignal),
    });
    expect(client.getQueryData(promotionKeys.list(1, selected))).toBeDefined();
    expect(
      client.getQueryData(promotionKeys.list(2, selected)),
    ).toBeUndefined();
    expect(
      client.getQueryData(promotionKeys.list(1, { ...selected, storeId: 20 })),
    ).toBeUndefined();
  });
  it("cancels an obsolete detail request through Axios's AbortSignal", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(API.get).mockImplementation((_url, config) => {
      signal =
        config?.signal instanceof AbortSignal ? config.signal : undefined;
      return new Promise(() => {});
    });
    const pending = renderHook(() => usePromotion(7)).refetch();
    await client.cancelQueries({ queryKey: promotionKeys.detail(1, 7) });
    expect(signal?.aborted).toBe(true);
    await pending;
  });
  it("uses the selected store endpoint and never carries previous-store placeholder data", async () => {
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
    vi.mocked(API.get).mockResolvedValue({
      data: {
        data: {
          items: [{ storeId: 10 }],
          ...filters,
          totalItems: 1,
          totalPages: 1,
        },
      },
    });
    await renderHook(() => useStorePromotions(10, filters)).refetch();
    expect(API.get).toHaveBeenCalledWith("/stores/10/promotions", {
      params: filters,
      signal: expect.any(AbortSignal),
    });
    session.storeId = 20;
    expect(
      renderHook(() => useStorePromotions(20, filters)).data,
    ).toBeUndefined();
  });
});
describe("promotion mutation transport", () => {
  it("sends a full update with its captured definition version", async () => {
    vi.mocked(API.put).mockResolvedValue({
      data: { data: { id: 7, definitionVersion: 3 } },
    });
    await renderHook(usePromotionMutations).save.mutateAsync({
      id: 7,
      version: 2,
      definition: definition(),
    });
    expect(API.put).toHaveBeenCalledWith("/promotions/7", {
      ...definition(),
      expectedDefinitionVersion: 2,
    });
  });
  it("leaves a stale draft unchanged and does not retry a conflict", async () => {
    const draft = definition();
    vi.mocked(API.put).mockRejectedValue({
      response: { status: 409, data: { code: "PROMOTION_VERSION_CONFLICT" } },
    });
    await expect(
      renderHook(usePromotionMutations).save.mutateAsync({
        id: 7,
        version: 2,
        definition: draft,
      }),
    ).rejects.toBeDefined();
    expect(API.put).toHaveBeenCalledTimes(1);
    expect(draft).toEqual(definition());
  });
  it("uses only the three accepted multipart parts and overrides the JSON content type", async () => {
    vi.mocked(API.post).mockResolvedValue({
      data: { data: { promotionId: 7, definitionVersion: 3 } },
    });
    const file = new File(["image"], "pizza.png", { type: "image/png" });
    await renderHook(usePromotionMutations).upload.mutateAsync({
      id: 7,
      file,
      variant: "desktop",
      imageAlt: " Pizza offer ",
    });
    const [url, body, config] = vi.mocked(API.post).mock.calls[0];
    expect(url).toBe("/promotions/7/images");
    expect(body).toBeInstanceOf(FormData);
    if (!(body instanceof FormData)) throw new Error("Expected multipart body");
    expect([...body.keys()].sort()).toEqual(["file", "imageAlt", "variant"]);
    expect(body.get("imageAlt")).toBe("Pizza offer");
    expect(body.get("variant")).toBe("desktop");
    expect(config?.headers).toEqual({ "Content-Type": undefined });
  });
  it("rejects a platform-admin store toggle even with a selected store", async () => {
    await expect(
      renderHook(usePromotionMutations).toggle.mutateAsync({
        storeId: 10,
        id: 7,
        enabled: true,
      }),
    ).rejects.toThrow("permission");
    expect(API.put).not.toHaveBeenCalled();
  });
  it("requires same-store manager permission and a disable reason before transport", async () => {
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
    vi.mocked(API.put).mockResolvedValue({ data: { data: { storeId: 10 } } });
    const mutations = renderHook(usePromotionMutations);
    await expect(
      mutations.toggle.mutateAsync({ storeId: 20, id: 7, enabled: true }),
    ).rejects.toThrow("permission");
    await expect(
      mutations.toggle.mutateAsync({ storeId: 10, id: 7, enabled: false }),
    ).rejects.toBeDefined();
    expect(API.put).not.toHaveBeenCalled();
    await mutations.toggle.mutateAsync({
      storeId: 10,
      id: 7,
      enabled: false,
      reason: " Out of stock ",
    });
    expect(API.put).toHaveBeenCalledWith("/stores/10/promotions/7/setting", {
      enabled: false,
      reason: "Out of stock",
    });
  });
});
