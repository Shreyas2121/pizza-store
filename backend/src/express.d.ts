import { Server } from "socket.io";

declare global {
  namespace Express {
    interface Application {
      io: Server;
    }
  }
}
