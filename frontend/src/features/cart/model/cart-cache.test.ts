import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { cartKeys } from "../api/cart.queries";
import { catalogKeys } from "@/features/catalog";

it("invalidates all cart views through the existing checkout failure prefix", async () => {
  const client = new QueryClient();
  const keys = [cartKeys.get(1), cartKeys.checkout(1), cartKeys.count(1)];
  keys.forEach((key) => client.setQueryData(key, { id: 1 }));
  await client.invalidateQueries({ queryKey: cartKeys.all });
  keys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  client.clear();
});
it("invalidates store menu availability through the existing catalogue failure prefix", async () => {
  const client = new QueryClient();
  const key = catalogKeys.products.allMenu(null, "1", "default", 10);
  client.setQueryData(key, [{ id: 1 }]);
  await client.invalidateQueries({ queryKey: catalogKeys.all });
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  client.clear();
});
