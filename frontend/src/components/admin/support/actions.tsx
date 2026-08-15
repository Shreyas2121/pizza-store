import { CHAT_API_HOOKS } from "@/hooks";
import { ChatSessionWithUser, success } from "@/lib";
import { Button } from "@mantine/core";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router";

const SupportActions = ({
  chatSession,
}: {
  chatSession: ChatSessionWithUser;
}) => {
  const navigate = useNavigate();
  const updateM = CHAT_API_HOOKS.useUpdateSupportRequest();
  const Comp = useMemo(() => {
    switch (chatSession.status) {
      case "pending":
        return (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                updateM.mutate(
                  { status: "open", chatId: chatSession.id },
                  {
                    onSuccess: (res) => {
                      success("Success");
                      navigate(
                        `/admin/support/${res.data.updatedChatSession.id}`
                      );
                    },
                  }
                );
              }}
              disabled={updateM.isPending}
              color="blue"
            >
              Approve
            </Button>
            <Button
              onClick={() => {
                updateM.mutate(
                  { status: "rejected", chatId: chatSession.id },
                  {
                    onSuccess: (res) => {
                      success("Success");
                    },
                  }
                );
              }}
              disabled={updateM.isPending}
            >
              Reject
            </Button>
          </div>
        );
      case "open":
        return (
          <Button>
            <Link to={`/admin/support/${chatSession.userId}`}>Chat</Link>
          </Button>
        );
      default:
        return <div>3</div>;
    }
  }, [chatSession]);

  return <>{Comp}</>;
};

export default SupportActions;
