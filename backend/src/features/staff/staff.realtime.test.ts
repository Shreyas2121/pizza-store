import { describe, expect, it, vi } from "vitest";
import { RealtimeEvents, type RealtimeServer } from "../realtime/realtime.types";
import { SocketIoStaffAccessNotifier } from "./staff.realtime";

describe("SocketIoStaffAccessNotifier", () => {
  it("notifies the affected user before disconnecting their sockets", async () => {
    const emit = vi.fn();
    const disconnect = vi.fn();
    const io = {
      to: vi.fn(() => ({ emit })),
      sockets: {
        adapter: {
          rooms: new Map([["user:7", new Set(["socket-1"])]]),
        },
        sockets: new Map([["socket-1", { disconnect }]]),
      },
    } as unknown as RealtimeServer;
    const notifier = new SocketIoStaffAccessNotifier(() => io);

    await notifier.membershipChanged({ userId: 7, storeId: 3 });

    expect(io.to).toHaveBeenCalledWith("user:7");
    expect(emit).toHaveBeenCalledWith(RealtimeEvents.membershipChanged, {
      storeId: 3,
      message: "Your store access has been updated.",
    });
    expect(disconnect).toHaveBeenCalledWith(true);
    expect(emit.mock.invocationCallOrder[0]).toBeLessThan(
      disconnect.mock.invocationCallOrder[0]
    );
  });

  it("does nothing when the realtime server is unavailable", async () => {
    const notifier = new SocketIoStaffAccessNotifier(() => undefined);

    await expect(
      notifier.membershipChanged({ userId: 7, storeId: 3 })
    ).resolves.toBeUndefined();
  });
});
