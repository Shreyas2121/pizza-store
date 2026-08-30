import type { Server } from "socket.io";
import type { StaffAccessNotifier } from "./staff.types";
import { evictUserSockets } from "../realtime/realtime-rooms";

export class SocketIoStaffAccessNotifier implements StaffAccessNotifier {
  constructor(private ioGetter: () => Server | undefined) {}

  async membershipChanged(input: { userId: number; storeId: number }): Promise<void> {
    const io = this.ioGetter();
    if (io) {
      evictUserSockets(io, input.userId);
    }
  }
}

let globalIoGetter: () => Server | undefined = () => undefined;

export const setRealtimeIoGetter = (getter: () => Server | undefined) => {
  globalIoGetter = getter;
};

export const staffAccessNotifier = new SocketIoStaffAccessNotifier(() => globalIoGetter());
