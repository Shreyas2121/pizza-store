import type { RealtimeServer } from "./realtime.types";

let realtimeServerGetter: () => RealtimeServer | undefined = () => undefined;

export const setRealtimeServerGetter = (
  getter: () => RealtimeServer | undefined
): void => {
  realtimeServerGetter = getter;
};

export const getRealtimeServer = (): RealtimeServer | undefined =>
  realtimeServerGetter();
