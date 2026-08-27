import { Server } from "socket.io";
import type { AuthPrincipal } from "./features/auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      principal?: AuthPrincipal;
    }

    interface Application {
      io: Server;
    }
  }
}
