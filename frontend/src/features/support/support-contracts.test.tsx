import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { supportKeys, useChatRequest, useGetActiveChat, useGetAllSupportRequests, useGetChatMessages, useGetExistingMessages, useGetSupportRequests, useSendMessage, useSyncChatStatus, useUpdateSupportStatus } from "./api/chat.queries";
import { useSupportStore } from "./model/support.store";
import { Chat } from "./components/chat";
import type { ChatSessionWithUser, Message } from "./model/support.types";

const session = vi.hoisted(() => ({ viewerId: 100, listeners: new Map<string, () => void>() }));
vi.mock("@/features/auth", () => ({ useUser: (selector: (state: { user: { id: number } | null }) => unknown) => selector({ user: session.viewerId ? { id: session.viewerId } : null }) }));
vi.mock("@/shared/realtime", async (original) => ({ ...await original<object>(), useSocketEvent: (event: string, listener: () => void) => { session.listeners.set(event, listener); } }));
vi.spyOn(API, "get"); vi.spyOn(API, "post"); vi.spyOn(API, "patch");
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks(); session.viewerId = 100; session.listeners.clear(); useSupportStore.setState({ chatSession: null });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity }, mutations: { retry: false } } });
});
afterEach(() => client.clear());
const render = (element: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test">{element}</MantineProvider></QueryClientProvider>);
function capture<T>(hook: () => T): T { let result: T | undefined; function Harness() { result = hook(); return null; } render(createElement(Harness)); if (!result) throw new Error("Hook did not render"); return result; }
const chat: ChatSessionWithUser = { id: 7, userId: 10, subject: "Order help", status: "open", createdAt: "2026-10-07T10:00:00Z", updatedAt: "2026-10-07T10:00:00Z", user: { id: 10, fname: "Test", lname: "Customer", email: "customer@example.test", role: "user", isActive: true, createdAt: "", updatedAt: "" } };
const message: Message = { id: 9, type: "admin", timestamp: "2026-10-07T10:00:00Z", message: "How can I help?" };

describe("support route contracts", () => {
  it.each(["pending", "open", "close", "rejected"] as const)("loads the %s queue using requests and a status parameter", async (status) => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: [chat] } });
    const result = await capture(() => useGetSupportRequests(status)).refetch();
    expect(result.data).toEqual([chat]);
    expect(API.get).toHaveBeenCalledWith("/chat/requests", { params: { status }, signal: expect.any(AbortSignal) });
  });
  it("defaults the legacy queue helper to the backend-supported pending filter", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: [] } });
    await capture(useGetAllSupportRequests).refetch();
    expect(API.get).toHaveBeenCalledWith("/chat/requests", { params: { status: "pending" }, signal: expect.any(AbortSignal) });
  });
  it.each([undefined, 10])("loads an active conversation with optional userId %s", async (userId) => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: chat } });
    const result = await capture(() => useGetActiveChat(userId)).refetch();
    expect(result.data?.id).toBe(7);
    expect(API.get).toHaveBeenCalledWith("/chat/active", { params: userId === undefined ? {} : { userId }, signal: expect.any(AbortSignal) });
  });
  it.each([undefined, 10])("loads message history with optional userId %s, not a session subpath", async (userId) => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: [message] } });
    await capture(() => useGetChatMessages(userId, 7)).refetch();
    expect(API.get).toHaveBeenCalledWith("/chat/messages", { params: userId === undefined ? {} : { userId }, signal: expect.any(AbortSignal) });
    expect(capture(() => useGetExistingMessages(userId, 7)).data).toEqual([message]);
  });
  it("posts a message with sessionId and returns the unwrapped message", async () => {
    client.setQueryData(supportKeys.messages(10, 7, 100), [message]);
    vi.mocked(API.post).mockResolvedValue({ data: { data: message } });
    const sent = await capture(useSendMessage).mutateAsync({ sessionId: 7, message: "Hello" });
    expect(API.post).toHaveBeenCalledWith("/chat/message", { sessionId: 7, message: "Hello" });
    expect(sent.id).toBe(9); expect(sent).not.toHaveProperty("data");
    expect(client.getQueryState(supportKeys.messages(10, 7, 100))?.isInvalidated).toBe(true);
  });
  it.each([{ chatId: "7", status: "open" as const }, { chatSessionId: 7, status: "rejected" as const }])("patches the request using a body chatId and refreshes active chats and queues", async (input) => {
    client.setQueryData(supportKeys.adminUserChat(10, 100), chat); client.setQueryData([...supportKeys.admin(), 100, "pending"], [chat]);
    vi.mocked(API.patch).mockResolvedValue({ data: { message: "Chat status updated", data: { updatedChatSession: chat, oldStatus: "pending" } } });
    await capture(useUpdateSupportStatus).mutateAsync(input);
    expect(API.patch).toHaveBeenCalledWith("/chat/request", { chatId: "7", status: input.status });
    expect(client.getQueryState(supportKeys.adminUserChat(10, 100))?.isInvalidated).toBe(true);
    expect(client.getQueryState([...supportKeys.admin(), 100, "pending"])?.isInvalidated).toBe(true);
  });
  it("rejects absent or invalid status-update IDs before making a request", async () => {
    for (const chatId of [undefined, "bad", 0, -1]) await expect(capture(useUpdateSupportStatus).mutateAsync({ chatId, status: "open" })).rejects.toThrow("valid chat session");
    expect(API.patch).not.toHaveBeenCalled();
  });
  it("creates support requests without a cast and refreshes conversation state", async () => {
    vi.mocked(API.post).mockResolvedValue({ data: { message: "Session created", data: chat } });
    const result = await capture(useChatRequest).mutateAsync({ title: "Order help" });
    expect(API.post).toHaveBeenCalledWith("/chat/request", { title: "Order help" }); expect(result.data.id).toBe(7);
  });
});

describe("conversation state and cache separation", () => {
  it("separates customers, sessions and authenticated viewers", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: [message] } });
    await capture(() => useGetExistingMessages(10, 7)).refetch();
    expect(capture(() => useGetExistingMessages(11, 7)).data).toBeUndefined();
    expect(capture(() => useGetExistingMessages(10, 8)).data).toBeUndefined();
    session.viewerId = 101; expect(capture(() => useGetExistingMessages(10, 7)).data).toBeUndefined();
  });
  it("does not reuse another viewer's active chat or support queue", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: chat } }); await capture(() => useGetActiveChat()).refetch();
    vi.mocked(API.get).mockResolvedValue({ data: { data: [chat] } }); await capture(useGetSupportRequests).refetch();
    session.viewerId = 101;
    expect(capture(() => useGetActiveChat()).data).toBeUndefined(); expect(capture(useGetSupportRequests).data).toBeUndefined();
  });
  it("syncs pending status and clears it when no active session exists", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: { ...chat, status: "pending" } } });
    await capture(useSyncChatStatus).refetch(); expect(useSupportStore.getState().chatSession).toBe("pending");
    vi.mocked(API.get).mockResolvedValue({ data: {} }); await capture(useSyncChatStatus).refetch(); expect(useSupportStore.getState().chatSession).toBeNull();
  });
  it("aborts requests for obsolete conversations", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(API.get).mockImplementation((_url, config) => { signal = config?.signal as AbortSignal; return new Promise(() => {}); });
    const pending = capture(() => useGetExistingMessages(10, 7)).refetch();
    await client.cancelQueries({ queryKey: supportKeys.messages(10, 7, 100) }); expect(signal?.aborted).toBe(true); await pending;
  });
  it("offers a retry when conversation lookup fails", async () => {
    vi.mocked(API.get).mockRejectedValue(new Error("Unavailable")); await capture(() => useGetActiveChat(10)).refetch();
    const html = render(<Chat userId={10} />); expect(html).toContain("Conversation could not be loaded"); expect(html).toContain("Retry");
  });
  it("shows a missing conversation without requesting history", () => {
    client.setQueryData(supportKeys.adminUserChat(10, 100), null);
    expect(render(<Chat userId={10} />)).toContain("No active conversation"); expect(API.get).not.toHaveBeenCalled();
  });
  it("renders the selected conversation history and disables pending-session messages", () => {
    client.setQueryData(supportKeys.adminUserChat(10, 100), { ...chat, status: "pending" });
    client.setQueryData(supportKeys.messages(10, 7, 100), [message]);
    const html = render(<Chat userId={10} />);
    expect(html).toContain("How can I help?"); expect(html).toContain("Test Customer");
    expect(html).toMatch(/<textarea[^>]*disabled/);
  });
  it("reloads selected message history after unscoped realtime events", () => {
    client.setQueryData(supportKeys.adminUserChat(10, 100), chat);
    client.setQueryData(supportKeys.messages(10, 7, 100), [message]);
    render(<Chat userId={10} />); session.listeners.get("newMessage")!();
    expect(client.getQueryState(supportKeys.messages(10, 7, 100))?.isInvalidated).toBe(true);
    expect(client.getQueryData(supportKeys.messages(10, 7, 100))).toEqual([message]);
  });
});
