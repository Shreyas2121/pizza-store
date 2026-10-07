import { afterEach, describe, expect, it, vi } from "vitest";
import { inventoryReservationsTable, storeProductsTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import { InventoryService, INVENTORY_RESERVATION_DURATION_MS } from "./inventory.service";

const now = new Date("2026-10-07T10:00:00Z");
function harness(status = "released", onHandQuantity: number | null = 8) {
  const rows = [{ id: 1, storeProductId: 9, quantity: 3, status }];
  const products = [{ id: 9, onHandQuantity, isAvailable: true }];
  const locks: unknown[] = [];
  const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
  const tx = {
    select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => {
      const result = table === storeProductsTable ? products : rows;
      return Object.assign(Promise.resolve(result), { orderBy: () => ({ for: (mode: string) => {
        locks.push([table, mode]); return Promise.resolve(result);
      } }) });
    } }) })),
    update: vi.fn(() => ({ set })),
  };
  const service = new InventoryService();
  vi.spyOn(service, "getActiveReservedQuantities").mockResolvedValue(new Map([[9, 2]]));
  // Partial transaction double: only the query methods exercised here exist.
  return { service, tx: tx as unknown as TransactionType, set, locks, rows };
}
afterEach(() => vi.restoreAllMocks());
describe("saved inventory reservation retry", () => {
  it("restores exact demand and renews expiry after deterministic stock/reservation locks", async () => {
    const h = harness();
    await h.service.restoreReservationsForOrder(4, h.tx, now);
    expect(h.locks).toEqual([[storeProductsTable, "update"], [inventoryReservationsTable, "update"]]);
    expect(h.set).toHaveBeenCalledWith({ status: "reserved", releasedAt: null, consumedAt: null,
      expiresAt: new Date(now.getTime() + INVENTORY_RESERVATION_DURATION_MS), updatedAt: now });
  });
  it("rejects insufficient stock before any reservation is changed", async () => {
    const h = harness("released", 4);
    await expect(h.service.restoreReservationsForOrder(4, h.tx, now)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(h.set).not.toHaveBeenCalled();
  });
  it("is idempotent for active reservations", async () => {
    const h = harness("reserved");
    await h.service.restoreReservationsForOrder(4, h.tx, now);
    expect(h.set).not.toHaveBeenCalled();
  });
  it("refuses consumed reservations", async () => {
    const h = harness("consumed");
    await expect(h.service.restoreReservationsForOrder(4, h.tx, now)).rejects.toMatchObject({ code: "INVENTORY_RESERVATIONS_STATE_CONFLICT" });
    expect(h.set).not.toHaveBeenCalled();
  });
  it("can restore a product whose inventory is now untracked", async () => {
    const h = harness("released", null);
    await h.service.restoreReservationsForOrder(4, h.tx, now);
    expect(h.set).toHaveBeenCalledOnce();
  });
  it("consumes an existing reservation after stock tracking is disabled", async () => {
    const h = harness("reserved", null);
    await expect(h.service.consumeReservationsForOrder(4, h.tx)).resolves.toEqual({ consumedCount: 1, alreadyConsumed: false });
    expect(h.set).toHaveBeenCalledWith(expect.objectContaining({ status: "consumed" }));
  });
});
