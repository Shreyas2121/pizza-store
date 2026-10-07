import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { accessKeys } from "./access.keys";

describe("access cache account isolation", () => {
  it("never reuses the previous account's capabilities for another account or logged-out session", () => {
    const client = new QueryClient();
    client.setQueryData(accessKeys.principal(1), {
      platformRole: "admin",
      memberships: [],
    });
    expect(client.getQueryData(accessKeys.principal(2))).toBeUndefined();
    expect(
      client.getQueryData(accessKeys.principal(undefined)),
    ).toBeUndefined();
    expect(client.getQueryData(accessKeys.principal(1))).toEqual({
      platformRole: "admin",
      memberships: [],
    });
    client.clear();
  });
  it("preserves prefix invalidation for membership changes and forbidden responses", async () => {
    const client = new QueryClient();
    client.setQueryData(accessKeys.principal(1), {});
    client.setQueryData(accessKeys.principal(2), {});
    await client.invalidateQueries({ queryKey: accessKeys.me() });
    expect(client.getQueryState(accessKeys.principal(1))?.isInvalidated).toBe(
      true,
    );
    expect(client.getQueryState(accessKeys.principal(2))?.isInvalidated).toBe(
      true,
    );
    client.clear();
  });
});
