import { useEffect, useState } from "react";
import { Settings, Send, UserCircle, Shield } from "lucide-react";
import { Loader } from "@mantine/core";
import { CHAT_API_HOOKS } from "@/hooks";
import { Message } from "@/lib";
import { useSocketStore } from "@/store";

interface Props {
  width?: string;
  height?: string;
  userId?: number;
}

const Chat = ({ height = "400px", width = "500px", userId }: Props) => {
  const isAdminView = !!userId;
  const { socket } = useSocketStore();
  const { data: chatSession, isLoading: loadingC } =
    CHAT_API_HOOKS.useGetActiveChat(userId);

  const { data: existingMessages, isLoading: loadingM } =
    CHAT_API_HOOKS.useGetExistingMessages(userId);

  const sendMessageM = CHAT_API_HOOKS.useSendMessage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (existingMessages) {
      setMessages(existingMessages);
    }
  }, [existingMessages]);

  useEffect(() => {
    if (socket){
      socket.emit("joinRoom", { userId: userId });
    }
  },[userId,socket])

  useEffect(() => {
    if (socket) {
      socket.on("newMessage", (incomingMessage) => {
        setMessages((prev) => [...prev, incomingMessage]);
      });

      // Cleanup the event on unmount
      return () => {
        socket.off("newMessage");
      };
    }
  }, [socket]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    sendMessageM.mutate(
      {
        message: newMessage,
        sessionId: chatSession?.id,
      }
    );

    setNewMessage("");
  };

  if (loadingC || loadingM) {
    return <Loader />;
  }

  return (
    <div
      className="shadow-xl rounded-lg overflow-hidden border border-orange-100 flex flex-col"
      style={{ width, height }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-orange-50">
              <h3 className="text-lg font-semibold leading-tight">
                {!userId
                  ? "Admin Support"
                  : `${chatSession!.user.fname} ${chatSession!.user.lname}`}
              </h3>
              <span className="text-sm flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Online
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-full hover:bg-orange-600 transition-colors text-orange-100">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 bg-orange-50 p-4 overflow-y-auto flex flex-col gap-3">
        {messages.map((message) => {
          const isOwnMessage = isAdminView
            ? message.type === "admin"
            : message.type === "user";
          return (
            <div
              key={message.id}
              className={`flex ${
                isOwnMessage ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.type === "user"
                    ? "bg-orange-500 text-white rounded-br-none"
                    : "bg-orange-100 text-orange-900 rounded-bl-none"
                }`}
              >
                <p className="text-sm">{message.message}</p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <span className="text-xs opacity-70">
                    {message.timestamp}
                  </span>
                  {message.type === "user" ? (
                    <UserCircle className="w-4 h-4" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-orange-100 p-4 bg-white"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-full px-4 py-2 border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          <button
            type="submit"
            className="p-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
