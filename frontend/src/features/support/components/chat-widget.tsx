import { useEffect } from "react";
import { Hourglass, MessageCircle, MessageCircleQuestion } from "lucide-react";
import { showNotification } from "@mantine/notifications";
import { useMediaQuery } from "@mantine/hooks";
import { useLocation } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Textarea } from "@mantine/core";
import { useChatRequest } from "../api/chat.queries";
import { ChatSession } from "../model/support.types";
import { useUser } from "@/features/auth";
import { useAuthModalStore } from "@/shared/model";
import { useSocketStore } from "@/store";
import { success } from "@/shared/lib";
import { Chat } from "@/components/common";

const chatRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { message: "Tell us briefly what you need help with" })
    .max(160, "Keep your request under 160 characters"),
});

type ChatRequestFormValues = z.infer<typeof chatRequestSchema>;

export const ChatRequestForm = () => {
  const requestM = useChatRequest();
  const { closeModal } = useAuthModalStore();
  const { setChatSession } = useSocketStore();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChatRequestFormValues>({
    resolver: zodResolver(chatRequestSchema),
  });

  const onSubmit = (data: ChatRequestFormValues) => {
    requestM.mutate(
      { title: data.title } as never,
      {
        onSuccess: (res: { message: string }) => {
          success(res.message);
          setChatSession("pending");
          reset();
          closeModal();
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-5">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
          <MessageCircleQuestion size={22} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-page-title-scale">How can we help?</h2>
        <p className="mt-2 text-supporting-scale">
          Share a short description so our support team has the right context.
        </p>
      </div>
      <Textarea
        disabled={requestM.isPending}
        label="What do you need help with?"
        withAsterisk
        placeholder="For example: I need help with my current order"
        minRows={3}
        maxLength={160}
        autosize
        {...register("title")}
        error={errors.title?.message}
      />
      <Button
        loading={requestM.isPending}
        loaderProps={{ type: "dots" }}
        type="submit"
        mt="lg"
        size="md"
        fullWidth
      >
        Request support
      </Button>
    </form>
  );
};

export const SupportAction = () => {
  const { openModal } = useAuthModalStore();
  const { chatSession, socket, setChatSession } = useSocketStore();
  const { isLoggedIn } = useUser();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 639px)");
  const aboveCommerceBar = location.pathname === "/cart";

  useEffect(() => {
    if (!socket) return;
    const handleStatusChange = (updatedData: string) => {
      const updatedSession = JSON.parse(updatedData) as ChatSession;
      if (updatedSession.status === "rejected")
        showNotification({
          message: "Your support request could not be accepted.",
          color: "red",
        });
      setChatSession(
        updatedSession.status === "open" || updatedSession.status === "pending"
          ? updatedSession.status
          : null
      );
    };
    socket.on("chatStatusChange", handleStatusChange);
    return () => {
      socket.off("chatStatusChange", handleStatusChange);
    };
  }, [socket, setChatSession]);

  if (!isLoggedIn) return null;
  const pending = chatSession === "pending";

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={
        pending
          ? "Support request pending"
          : chatSession === "open"
            ? "Open support chat"
            : "Request support"
      }
      style={{
        bottom: aboveCommerceBar
          ? "calc(max(1rem, env(safe-area-inset-bottom)) + 5.25rem)"
          : "max(1.5rem, env(safe-area-inset-bottom))",
      }}
      className="fixed left-4 z-40 flex min-h-11 items-center gap-2 rounded-pill bg-brand px-4 font-semibold text-white shadow-panel transition-colors hover:bg-brand-hover disabled:bg-ink-muted disabled:opacity-90 sm:left-8"
      onClick={() => {
        if (chatSession === "open") {
          openModal({
            content: <Chat height={isMobile ? "calc(100dvh - 60px)" : "620px"} />,
            title: "",
            options: { size: 480, padding: 0, radius: "lg", fullScreen: isMobile },
          });
        } else {
          openModal({
            content: <ChatRequestForm />,
            title: "",
            options: { size: 440, padding: "lg", radius: "lg" },
          });
        }
      }}
    >
      {pending ? <Hourglass size={18} /> : <MessageCircle size={19} />}
      <span>
        {pending
          ? "Support requested"
          : chatSession === "open"
            ? "Support chat"
            : "Support"}
      </span>
    </button>
  );
};

export default SupportAction;
