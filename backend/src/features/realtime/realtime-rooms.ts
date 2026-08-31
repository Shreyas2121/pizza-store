import type { Server, Socket } from "socket.io";
import type { AuthPrincipal } from "../auth/auth.types";
import type { MembershipAccessRecord } from "../access/access.types";
import { roleHasPermission } from "../access/access.permissions";

export const RealtimeRooms = {
  user: (userId: number) => `user:${userId}`,
  platformAdmin: () => "platform-admin",
  platformSupport: () => "platform-support",
  storeOperations: (storeId: number) => `store:${storeId}:operations`,
  storeOrders: (storeId: number) => `store:${storeId}:orders`,
  storeInventory: (storeId: number) => `store:${storeId}:inventory`,
} as const;

export function deriveRoomsForPrincipal(
  principal: AuthPrincipal,
  memberships: MembershipAccessRecord[] = []
): string[] {
  const rooms = new Set<string>();

  // Every authenticated user receives their personal user room
  rooms.add(RealtimeRooms.user(principal.userId));

  if (principal.platformRole === "admin") {
    rooms.add(RealtimeRooms.platformAdmin());
    rooms.add(RealtimeRooms.platformSupport());
    return Array.from(rooms);
  }

  for (const membership of memberships) {
    if (membership.status !== "active" || !membership.storeIsActive) {
      continue;
    }

    if (roleHasPermission(membership.role, "dashboard.operations.read")) {
      rooms.add(RealtimeRooms.storeOperations(membership.storeId));
    }

    if (["manager", "finance_manager", "operator"].includes(membership.role)) {
      rooms.add(RealtimeRooms.storeOrders(membership.storeId));
    }
    if (["manager", "finance_manager", "inventory_staff"].includes(membership.role)) {
      rooms.add(RealtimeRooms.storeInventory(membership.storeId));
    }
  }

  return Array.from(rooms);
}

export function syncSocketRooms(
  socket: Socket,
  principal: AuthPrincipal,
  memberships: MembershipAccessRecord[] = []
): string[] {
  const targetRooms = deriveRoomsForPrincipal(principal, memberships);
  for (const room of targetRooms) {
    socket.join(room);
  }
  return targetRooms;
}

export function evictUserSockets(io: Server | undefined, userId: number): void {
  if (!io) return;
  const userRoom = RealtimeRooms.user(userId);
  const roomSockets = io.sockets.adapter.rooms.get(userRoom);
  if (roomSockets) {
    for (const socketId of Array.from(roomSockets)) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    }
  }
}
