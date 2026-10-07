import { FormEvent, useEffect, useRef, useState } from "react";
import { Alert, Button, Skeleton } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { Headphones, MessageCircle, Send } from "lucide-react";
import {
  useGetActiveChat,
  useGetExistingMessages,
  useSendMessage,
  supportKeys,
} from "../api/chat.queries";
import { LoadingRegion } from "@/shared/ui";
import { formatTime } from "@/shared/lib";
import { RealtimeEvents, useSocketEvent } from "@/shared/realtime";

interface Props {
  width?: string;
  height?: string;
  userId?: number;
}

export const Chat = ({ height = "620px", width = "100%", userId }: Props) => {
  const isAdminView = typeof userId === "number";
  const queryClient = useQueryClient();
  const activeChat = useGetActiveChat(userId);
  const { data: chatSession, isLoading: loadingChat } = activeChat;
  const history = useGetExistingMessages(userId, chatSession?.id, Boolean(chatSession?.id));
  const { data: existingMessages, isLoading: loadingMessages } = history;
  const sendMessageM = useSendMessage();
  const messages = existingMessages ?? [];
  const [newMessage, setNewMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Support-room events include other customers and carry no session ID.
  // Reload the selected conversation instead of appending an unscoped message.
  useSocketEvent(RealtimeEvents.newMessage, () => {
    void queryClient.invalidateQueries({ queryKey: ["support", "messages"] });
  });
  useSocketEvent(RealtimeEvents.chatStatusChange, () => {
    void queryClient.invalidateQueries({ queryKey: supportKeys.all });
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [existingMessages]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = newMessage.trim();
    if (!message || !chatSession?.id || chatSession.status !== "open" || sendMessageM.isPending) return;
    sendMessageM.mutate(
      { message, sessionId: chatSession.id },
      {
        onSuccess: () => {
          setNewMessage("");
        },
      }
    );
  };

  if (loadingChat || loadingMessages) {
    return (
      <LoadingRegion label="Loading support conversation">
        <div className="flex flex-col gap-3 p-5" style={{ width, height }}>
          <Skeleton height={64} radius="lg" />
          <Skeleton height={72} width="72%" radius="lg" />
          <Skeleton height={72} width="65%" ml="auto" radius="lg" />
          <Skeleton height={48} radius="xl" className="mt-auto" />
        </div>
      </LoadingRegion>
    );
  }

  if (activeChat.isError || history.isError) {
    return <Alert color="red" title="Conversation could not be loaded">
      Please try again.
      <Button variant="subtle" onClick={() => { void activeChat.refetch(); if (chatSession?.id) void history.refetch(); }}>Retry</Button>
    </Alert>;
  }

  if (!chatSession) {
    return (
      <div className="flex items-center justify-center bg-canvas p-6 text-center" style={{ width, height }}>
        <div>
          <MessageCircle className="mx-auto text-brand" size={36} />
          <h2 className="mt-3 text-card-title-scale">No active conversation</h2>
          <p className="mt-2 text-sm text-ink-muted">
            This support session may have ended. Close this panel to request help again.
          </p>
        </div>
      </div>
    );
  }

  const title = isAdminView
    ? `${chatSession.user.fname} ${chatSession.user.lname}`
    : "PizzaStore support";

  return (
    <section
      className="flex max-h-[calc(100dvh-60px)] flex-col overflow-hidden bg-surface"
      style={{ width, height }}
      aria-label="Support conversation"
    >
      <header className="shrink-0 border-b border-border bg-ink px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand">
            <Headphones size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{title}</h2>
            <p className="mt-0.5 truncate text-xs text-white/65">
              {chatSession.subject || "Support chat"}
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-4 py-5" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-52 items-center justify-center text-center">
            <div>
              <MessageCircle className="mx-auto text-brand/60" size={30} />
              <p className="mt-3 font-semibold text-ink">Start the conversation</p>
              <p className="mt-1 max-w-xs text-sm text-ink-muted">
                Send a message and the support team will reply here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const own = isAdminView ? message.type === "admin" : message.type === "user";
              return (
                <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-subtle sm:max-w-[75%] ${
                      own
                        ? "rounded-br-md bg-brand text-white"
                        : "rounded-bl-md border border-border bg-surface text-ink"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.message}</p>
                    <p className={`mt-1 text-right text-[11px] ${own ? "text-white/65" : "text-ink-muted"}`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={submit}
        className="shrink-0 border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      >
        <div className="flex items-end gap-2">
          <label htmlFor="support-message" className="sr-only">
            Message
          </label>
          <textarea
            id="support-message"
            rows={1}
            value={newMessage}
            disabled={sendMessageM.isPending || chatSession.status !== "open"}
            onChange={(event) => setNewMessage(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Write a message…"
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
          />
          <Button
            type="submit"
            size="md"
            px={13}
            loading={sendMessageM.isPending}
            disabled={!newMessage.trim() || chatSession.status !== "open"}
            aria-label="Send message"
          >
            <Send size={18} />
          </Button>
        </div>
      </form>
    </section>
  );
};

export default Chat;
