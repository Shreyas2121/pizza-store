import type { StaffAccessNotifier } from "./staff.types";
import {
  evictUserSockets,
  RealtimeRooms,
} from "../realtime/realtime-rooms";
import {
  RealtimeEvents,
  type RealtimeServer,
} from "../realtime/realtime.types";
import { getRealtimeServer } from "../realtime/realtime-server";

export class SocketIoStaffAccessNotifier implements StaffAccessNotifier {
  constructor(private ioGetter: () => RealtimeServer | undefined) {}

  async membershipChanged(input: { userId: number; storeId: number }): Promise<void> {
    const io = this.ioGetter();
    if (io) {
      io.to(RealtimeRooms.user(input.userId)).emit(
        RealtimeEvents.membershipChanged,
        {
          storeId: input.storeId,
          message: "Your store access has been updated.",
        }
      );
      evictUserSockets(io, input.userId);
    }
  }
}

export const staffAccessNotifier = new SocketIoStaffAccessNotifier(
  getRealtimeServer
);
