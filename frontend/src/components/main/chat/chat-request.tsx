import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, TextInput } from "@mantine/core";
import { CHAT_API_HOOKS } from "@/hooks";
import { useAuthModalStore, useSocketStore } from "@/store";
import { success } from "@/lib";

const chatRequestSchema = z.object({
  title: z.string().min(1, { message: "Chat title is required" }),
});

type ChatRequestFormValues = z.infer<typeof chatRequestSchema>;

const ChatRequest = () => {
  const requestM = CHAT_API_HOOKS.useChatRequest();
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
      { title: data.title },
      {
        onSuccess: (res) => {
          success(res.message);
          setChatSession("pending");
          reset();
          closeModal();
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <TextInput
        disabled={requestM.isPending}
        label="Chat Title"
        placeholder="Enter a chat title"
        {...register("title")}
        error={errors.title?.message}
      />
      <Button disabled={requestM.isPending} type="submit" mt="md">
        Request Chat
      </Button>
    </form>
  );
};

export default ChatRequest;
