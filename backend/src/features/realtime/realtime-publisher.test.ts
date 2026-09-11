import { afterEach, describe, expect, it, vi } from "vitest";
import { setRealtimeServerGetter } from "./realtime-server";
import {
  publishExpenseStatusChanged,
  publishInventoryChanged,
  publishRefundStatusChanged,
} from "./realtime-publisher";
import { RealtimeEvents, type RealtimeServer } from "./realtime.types";

const createServer = () => {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  return { io: { to } as unknown as RealtimeServer, to, emit };
};

describe("realtime publishers", () => {
  afterEach(() => {
    setRealtimeServerGetter(() => undefined);
  });

  it("publishes inventory snapshots only to inventory-authorized audiences", () => {
    const { io, to, emit } = createServer();
    setRealtimeServerGetter(() => io);
    const payload = {
      storeId: 3,
      storeProductId: 8,
      productId: 5,
      productName: "Pizza",
      action: "restock" as const,
      previousQuantity: 4,
      newQuantity: 10,
      quantityChange: 6,
    };

    publishInventoryChanged(payload);

    expect(to).toHaveBeenCalledWith([
      "store:3:inventory",
      "platform-admin",
    ]);
    expect(emit).toHaveBeenCalledWith(RealtimeEvents.inventoryChanged, payload);
  });

  it("publishes refund status to finance, requester, and platform admin", () => {
    const { io, to, emit } = createServer();
    setRealtimeServerGetter(() => io);

    publishRefundStatusChanged({
      id: 12,
      orderId: 42,
      storeId: 3,
      requestedBy: 7,
      status: "processed",
      amountPaise: 15_000,
      updatedAt: new Date("2026-09-11T10:00:00.000Z"),
    });

    expect(to).toHaveBeenCalledWith([
      "store:3:finance",
      "user:7",
      "platform-admin",
    ]);
    expect(emit).toHaveBeenCalledWith(
      RealtimeEvents.refundStatusChanged,
      expect.objectContaining({
        refundId: 12,
        status: "processed",
        updatedAt: "2026-09-11T10:00:00.000Z",
      })
    );
  });

  it("publishes expense steps to finance and platform admin", () => {
    const { io, to, emit } = createServer();
    setRealtimeServerGetter(() => io);

    publishExpenseStatusChanged(
      {
        id: 21,
        storeId: 3,
        status: "approved",
        version: 4,
        updatedAt: "2026-09-11T10:05:00.000Z",
      },
      "approve"
    );

    expect(to).toHaveBeenCalledWith([
      "store:3:finance",
      "platform-admin",
    ]);
    expect(emit).toHaveBeenCalledWith(
      RealtimeEvents.expenseStatusChanged,
      expect.objectContaining({
        expenseId: 21,
        action: "approve",
        status: "approved",
        version: 4,
      })
    );
  });
});
