import { Server } from "socket.io";
import type { AuthPrincipal } from "./features/auth/auth.types";
import type { StoreAuthorizationContext } from "./features/access/access.types";

declare global {
  namespace Express {
    interface Request {
      principal?: AuthPrincipal;
      authorization?: StoreAuthorizationContext;
    }

    interface Application {
      io: Server;
    }
  }
}
