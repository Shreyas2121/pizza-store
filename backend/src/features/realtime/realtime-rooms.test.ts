import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import type { AuthPrincipal } from "../auth/auth.types";
import type { AccessRepository, MembershipAccessRecord } from "../access/access.types";
import { AuthenticationService } from "../auth/auth.service";
import {
  RealtimeRooms,
  deriveRoomsForPrincipal,
  evictUserSockets,
  syncSocketRooms,
} from "./realtime-rooms";
import { createSocketAuthMiddleware, extractBearerToken } from "./realtime-auth";

const adminPrincipal: AuthPrincipal = {
  userId: 1,
  email: "admin@example.com",
  platformRole: "admin",
  tokenVersion: 1,
};

const managerPrincipal: AuthPrincipal = {
  userId: 10,
  email: "manager@example.com",
  platformRole: "user",
  tokenVersion: 1,
};

const operatorPrincipal: AuthPrincipal = {
  userId: 20,
  email: "operator@example.com",
  platformRole: "user",
  tokenVersion: 1,
};

const inventoryPrincipal: AuthPrincipal = {
  userId: 30,
  email: "inventory@example.com",
  platformRole: "user",
  tokenVersion: 1,
};

const financePrincipal: AuthPrincipal = {
  userId: 31,
  email: "finance@example.com",
  platformRole: "user",
  tokenVersion: 1,
};

const payrollPrincipal: AuthPrincipal = {
  userId: 32,
  email: "payroll@example.com",
  platformRole: "user",
  tokenVersion: 1,
};

const customerPrincipal: AuthPrincipal = {
  userId: 99,
  email: "customer@example.com",
  platformRole: "user",
  tokenVersion: 1,
};

const multiStaffPrincipal: AuthPrincipal = {
  userId: 40,
  email: "multistaff@example.com",
  platformRole: "user",
  tokenVersion: 1,
};

const memberships: MembershipAccessRecord[] = [
  {
    membershipId: 101,
    userId: 10,
    storeId: 1,
    role: "manager",
    status: "active",
    storeIsActive: true,
    storeName: "Store 1",
    storeSlug: "store-1",
  },
  {
    membershipId: 102,
    userId: 20,
    storeId: 1,
    role: "operator",
    status: "active",
    storeIsActive: true,
    storeName: "Store 1",
    storeSlug: "store-1",
  },
  {
    membershipId: 103,
    userId: 30,
    storeId: 1,
    role: "inventory_staff",
    status: "active",
    storeIsActive: true,
    storeName: "Store 1",
    storeSlug: "store-1",
  },
  {
    membershipId: 104,
    userId: 31,
    storeId: 1,
    role: "finance_manager",
    status: "active",
    storeIsActive: true,
    storeName: "Store 1",
    storeSlug: "store-1",
  },
  {
    membershipId: 105,
    userId: 32,
    storeId: 1,
    role: "payroll_manager",
    status: "active",
    storeIsActive: true,
    storeName: "Store 1",
    storeSlug: "store-1",
  },
  {
    membershipId: 106,
    userId: 40,
    storeId: 1,
    role: "operator",
    status: "active",
    storeIsActive: true,
    storeName: "Store 1",
    storeSlug: "store-1",
  },
  {
    membershipId: 107,
    userId: 40,
    storeId: 2,
    role: "inventory_staff",
    status: "active",
    storeIsActive: true,
    storeName: "Store 2",
    storeSlug: "store-2",
  },
  {
    membershipId: 108,
    userId: 50,
    storeId: 3,
    role: "manager",
    status: "revoked", // Inactive membership
    storeIsActive: true,
    storeName: "Store 3",
    storeSlug: "store-3",
  },
  {
    membershipId: 109,
    userId: 60,
    storeId: 4,
    role: "manager",
    status: "active",
    storeIsActive: false, // Inactive store
    storeName: "Store 4",
    storeSlug: "store-4",
  },
];

describe("Realtime Rooms & Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deriveRoomsForPrincipal", () => {
    it("derives user personal room, platform-admin, and platform-support for platform admin", () => {
      const rooms = deriveRoomsForPrincipal(adminPrincipal);
      expect(rooms).toEqual([
        "user:1",
        "platform-admin",
        "platform-support",
      ]);
    });

    it("derives personal room only for ordinary customer with no store memberships", () => {
      const rooms = deriveRoomsForPrincipal(customerPrincipal, []);
      expect(rooms).toEqual(["user:99"]);
    });

    it("derives operations, orders, inventory, and finance rooms for store manager", () => {
      const managerMemberships = memberships.filter(
        (m) => m.userId === managerPrincipal.userId
      );
      const rooms = deriveRoomsForPrincipal(managerPrincipal, managerMemberships);
      expect(rooms).toEqual([
        "user:10",
        "store:1:operations",
        "store:1:orders",
        "store:1:inventory",
        "store:1:finance",
      ]);
    });

    it("derives operations and orders rooms for operator (excluding inventory room)", () => {
      const operatorMemberships = memberships.filter(
        (m) => m.userId === operatorPrincipal.userId
      );
      const rooms = deriveRoomsForPrincipal(operatorPrincipal, operatorMemberships);
      expect(rooms).toEqual([
        "user:20",
        "store:1:operations",
        "store:1:orders",
      ]);
    });

    it("derives operations and inventory rooms for inventory staff (excluding orders room)", () => {
      const inventoryMemberships = memberships.filter(
        (m) => m.userId === inventoryPrincipal.userId
      );
      const rooms = deriveRoomsForPrincipal(inventoryPrincipal, inventoryMemberships);
      expect(rooms).toEqual([
        "user:30",
        "store:1:operations",
        "store:1:inventory",
      ]);
    });

    it("derives operational lookup and finance rooms for finance manager", () => {
      const financeMemberships = memberships.filter(
        (membership) => membership.userId === financePrincipal.userId
      );
      expect(deriveRoomsForPrincipal(financePrincipal, financeMemberships)).toEqual([
        "user:31",
        "store:1:operations",
        "store:1:orders",
        "store:1:inventory",
        "store:1:finance",
      ]);
    });

    it("keeps payroll manager out of general store operation rooms", () => {
      const payrollMemberships = memberships.filter(
        (membership) => membership.userId === payrollPrincipal.userId
      );
      expect(deriveRoomsForPrincipal(payrollPrincipal, payrollMemberships)).toEqual([
        "user:32",
      ]);
    });

    it("derives distinct store rooms for multi-store staff across different roles", () => {
      const multiMemberships = memberships.filter(
        (m) => m.userId === multiStaffPrincipal.userId
      );
      const rooms = deriveRoomsForPrincipal(multiStaffPrincipal, multiMemberships);
      expect(rooms).toEqual([
        "user:40",
        "store:1:operations",
        "store:1:orders",
        "store:2:operations",
        "store:2:inventory",
      ]);
    });

    it("ignores revoked memberships and inactive stores", () => {
      const revokedPrincipal: AuthPrincipal = {
        userId: 50,
        email: "revoked@example.com",
        platformRole: "user",
        tokenVersion: 1,
      };
      const revokedMemberships = memberships.filter((m) => m.userId === 50);
      const rooms = deriveRoomsForPrincipal(revokedPrincipal, revokedMemberships);
      expect(rooms).toEqual(["user:50"]);

      const inactiveStorePrincipal: AuthPrincipal = {
        userId: 60,
        email: "inactive@example.com",
        platformRole: "user",
        tokenVersion: 1,
      };
      const inactiveStoreMemberships = memberships.filter((m) => m.userId === 60);
      const inactiveStoreRooms = deriveRoomsForPrincipal(
        inactiveStorePrincipal,
        inactiveStoreMemberships
      );
      expect(inactiveStoreRooms).toEqual(["user:60"]);
    });
  });

  describe("syncSocketRooms", () => {
    it("joins all derived rooms on the socket instance", () => {
      const joinedRooms: string[] = [];
      const mockSocket = {
        join: vi.fn((room: string) => {
          joinedRooms.push(room);
        }),
      } as unknown as Socket;

      const managerMemberships = memberships.filter(
        (m) => m.userId === managerPrincipal.userId
      );
      const rooms = syncSocketRooms(mockSocket, managerPrincipal, managerMemberships);

      expect(mockSocket.join).toHaveBeenCalledTimes(5);
      expect(joinedRooms).toEqual(rooms);
    });
  });

  describe("extractBearerToken", () => {
    it("extracts token from handshake auth token", () => {
      const mockSocket = {
        handshake: {
          auth: { token: "Bearer sample_token_123" },
          headers: {},
        },
      } as unknown as Socket;

      expect(extractBearerToken(mockSocket)).toBe("sample_token_123");
    });

    it("extracts token from handshake headers authorization", () => {
      const mockSocket = {
        handshake: {
          auth: {},
          headers: { authorization: "Bearer header_token_456" },
        },
      } as unknown as Socket;

      expect(extractBearerToken(mockSocket)).toBe("header_token_456");
    });

    it("returns undefined when no token is present", () => {
      const mockSocket = {
        handshake: {
          auth: {},
          headers: {},
        },
      } as unknown as Socket;

      expect(extractBearerToken(mockSocket)).toBeUndefined();
    });
  });

  describe("createSocketAuthMiddleware", () => {
    it("authenticates token, derives rooms, and attaches principal to socket data", async () => {
      const authService = {
        authenticateToken: vi.fn().mockResolvedValue(managerPrincipal),
      } as unknown as AuthenticationService;

      const accessRepository: AccessRepository = {
        findMembership: vi.fn(),
        listMemberships: vi.fn().mockResolvedValue(
          memberships.filter((m) => m.userId === managerPrincipal.userId)
        ),
      };

      const middleware = createSocketAuthMiddleware(authService, accessRepository);

      const mockSocket = {
        handshake: {
          auth: { token: "valid_jwt_token" },
          headers: {},
        },
        data: {},
        join: vi.fn(),
      } as unknown as Socket;

      const next = vi.fn();

      await middleware(mockSocket, next);

      expect(authService.authenticateToken).toHaveBeenCalledWith("valid_jwt_token");
      expect((mockSocket.data as any).principal).toEqual(managerPrincipal);
      expect(mockSocket.join).toHaveBeenCalledWith("user:10");
      expect(mockSocket.join).toHaveBeenCalledWith("store:1:operations");
      expect(mockSocket.join).toHaveBeenCalledWith("store:1:orders");
      expect(mockSocket.join).toHaveBeenCalledWith("store:1:inventory");
      expect(next).toHaveBeenCalledWith();
    });

    it("rejects connection when handshake token is missing", async () => {
      const authService = {
        authenticateToken: vi.fn(),
      } as unknown as AuthenticationService;

      const accessRepository: AccessRepository = {
        findMembership: vi.fn(),
        listMemberships: vi.fn(),
      };

      const middleware = createSocketAuthMiddleware(authService, accessRepository);

      const mockSocket = {
        handshake: { auth: {}, headers: {} },
        data: {},
        join: vi.fn(),
      } as unknown as Socket;

      const next = vi.fn();

      await middleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(authService.authenticateToken).not.toHaveBeenCalled();
    });

    it("rejects connection when token authentication fails (expired/revoked/invalid)", async () => {
      const authService = {
        authenticateToken: vi
          .fn()
          .mockRejectedValue(new Error("Access token has expired.")),
      } as unknown as AuthenticationService;

      const accessRepository: AccessRepository = {
        findMembership: vi.fn(),
        listMemberships: vi.fn(),
      };

      const middleware = createSocketAuthMiddleware(authService, accessRepository);

      const mockSocket = {
        handshake: {
          auth: { token: "expired_token" },
          headers: {},
        },
        data: {},
        join: vi.fn(),
      } as unknown as Socket;

      const next = vi.fn();

      await middleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("evictUserSockets", () => {
    it("disconnects all active sockets in the user room on staff revocation", () => {
      const disconnectSpy = vi.fn();
      const mockIo = {
        sockets: {
          adapter: {
            rooms: new Map([["user:10", new Set(["socket_abc", "socket_def"])]]),
          },
          sockets: new Map([
            ["socket_abc", { disconnect: disconnectSpy }],
            ["socket_def", { disconnect: disconnectSpy }],
          ]),
        },
      } as any;

      evictUserSockets(mockIo, 10);

      expect(disconnectSpy).toHaveBeenCalledTimes(2);
      expect(disconnectSpy).toHaveBeenCalledWith(true);
    });

    it("handles non-existent user rooms gracefully", () => {
      const mockIo = {
        sockets: {
          adapter: {
            rooms: new Map(),
          },
          sockets: new Map(),
        },
      } as any;

      expect(() => evictUserSockets(mockIo, 999)).not.toThrow();
    });
  });

  describe("Realtime Event to Room Mapping", () => {
    it("maps order events to customer, store orders, and platform admin rooms", () => {
      const order = { id: 42, storeId: 1, userId: 10, totalPrice: 500 };
      const audiences = [
        RealtimeRooms.user(order.userId),
        RealtimeRooms.storeOrders(order.storeId),
        RealtimeRooms.platformAdmin(),
      ];

      expect(audiences).toEqual([
        "user:10",
        "store:1:orders",
        "platform-admin",
      ]);
    });

    it("maps lowStock to store inventory and platform admin rooms", () => {
      const alert = { storeId: 1, productId: 5, severity: "low_stock" };
      const audiences = [
        RealtimeRooms.storeInventory(alert.storeId),
        RealtimeRooms.platformAdmin(),
      ];

      expect(audiences).toEqual([
        "store:1:inventory",
        "platform-admin",
      ]);
    });

    it("maps inventory changes to store inventory and platform admin rooms", () => {
      const audiences = [
        RealtimeRooms.storeInventory(1),
        RealtimeRooms.platformAdmin(),
      ];

      expect(audiences).toEqual([
        "store:1:inventory",
        "platform-admin",
      ]);
    });

    it("maps finance workflow changes to the finance room and platform admin", () => {
      const audiences = [
        RealtimeRooms.storeFinance(1),
        RealtimeRooms.platformAdmin(),
      ];

      expect(audiences).toEqual([
        "store:1:finance",
        "platform-admin",
      ]);
    });

    it("maps chat requests to platform support room", () => {
      expect(RealtimeRooms.platformSupport()).toBe("platform-support");
    });

    it("maps chat messages to participant user and platform support", () => {
      const audiences = [
        RealtimeRooms.user(7),
        RealtimeRooms.platformSupport(),
      ];

      expect(audiences).toEqual([
        "user:7",
        "platform-support",
      ]);
    });
  });
});
