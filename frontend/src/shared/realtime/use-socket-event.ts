import { useEffect, useRef } from "react";
import type { ServerToClientEvents } from "./realtime.types";
import { useSocketStore } from "./socket.store";

type EventName = keyof ServerToClientEvents;
type EventPayload<TEvent extends EventName> = Parameters<
  ServerToClientEvents[TEvent]
>[0];

export function useSocketEvent<TEvent extends EventName>(
  event: TEvent,
  handler: (payload: EventPayload<TEvent>) => void
) {
  const socket = useSocketStore((state) => state.socket);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!socket) return;

    const listener = (payload: unknown) => {
      handlerRef.current(payload as EventPayload<TEvent>);
    };
    const eventSocket = socket as unknown as {
      on: (name: string, callback: (payload: unknown) => void) => void;
      off: (name: string, callback: (payload: unknown) => void) => void;
    };

    eventSocket.on(event, listener);
    return () => {
      eventSocket.off(event, listener);
    };
  }, [event, socket]);
}
