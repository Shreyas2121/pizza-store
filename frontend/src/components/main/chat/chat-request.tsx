import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Textarea } from "@mantine/core";
import { MessageCircleQuestion } from "lucide-react";
import { CHAT_API_HOOKS } from "@/hooks";
import { useSocketStore } from "@/store";
import { useAuthModalStore } from "@/shared/model";
import { success } from "@/lib";

const chatRequestSchema = z.object({
  title: z.string().trim().min(3, { message: "Tell us briefly what you need help with" }).max(160, "Keep your request under 160 characters"),
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-5">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand"><MessageCircleQuestion size={22} aria-hidden="true" /></span>
        <h2 className="mt-4 text-page-title-scale">How can we help?</h2>
        <p className="mt-2 text-supporting-scale">Share a short description so our support team has the right context.</p>
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
      <Button loading={requestM.isPending} loaderProps={{ type: "dots" }} type="submit" mt="lg" size="md" fullWidth>
        Request support
      </Button>
    </form>
  );
};

export default ChatRequest;
