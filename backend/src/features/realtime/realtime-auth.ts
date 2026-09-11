import defaultAuthService, { AuthenticationService } from "../auth/auth.service";
import { DrizzleAccessRepository } from "../access/access.service";
import type { AccessRepository } from "../access/access.types";
import { syncSocketRooms } from "./realtime-rooms";
import { logger } from "../../utils/logger";
import type {
  RealtimeSocket,
  RealtimeSocketData,
} from "./realtime.types";

export type SocketData = RealtimeSocketData;

export const extractBearerToken = (socket: RealtimeSocket): string | undefined => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim().length > 0) {
    return authToken.trim().replace(/^Bearer\s+/i, "");
  }
  const headerAuth = socket.handshake.headers?.authorization;
  if (typeof headerAuth === "string" && headerAuth.trim().length > 0) {
    return headerAuth.trim().replace(/^Bearer\s+/i, "");
  }
  return undefined;
};

export const createSocketAuthMiddleware = (
  authService: AuthenticationService = defaultAuthService,
  accessRepository: AccessRepository = new DrizzleAccessRepository()
) => {
  return async (socket: RealtimeSocket, next: (err?: Error) => void) => {
    try {
      const token = extractBearerToken(socket);
      if (!token) {
        return next(new Error("Authentication token required"));
      }

      const principal = await authService.authenticateToken(token);
      (socket.data as SocketData).principal = principal;

      const memberships =
        principal.platformRole === "admin"
          ? []
          : await accessRepository.listMemberships({ userId: principal.userId });

      const rooms = syncSocketRooms(socket, principal, memberships);
      logger.info(
        `🔌 [Socket.io] Authenticated user ${principal.userId} (${principal.platformRole}) joined rooms: ${rooms.join(", ")}`
      );

      next();
    } catch (err: any) {
      logger.warn(`🔌 [Socket.io] Authentication failed: ${err.message}`);
      next(new Error("Authentication error"));
    }
  };
};
