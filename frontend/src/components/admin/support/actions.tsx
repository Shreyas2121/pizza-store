import { CHAT_API_HOOKS } from "@/hooks";
import { ChatSessionWithUser, success } from "@/lib";
import { ActionIcon, Button, Menu } from "@mantine/core";
import { MoreHorizontal, XCircle } from "lucide-react";
import { Link, useNavigate } from "react-router";

const SupportActions = ({ chatSession }: { chatSession: ChatSessionWithUser }) => {
  const navigate = useNavigate();
  const update = CHAT_API_HOOKS.useUpdateSupportRequest();

  if (chatSession.status === "pending") {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button size="xs" color="brand" loading={update.isPending} onClick={() => update.mutate({ status: "open", chatId: String(chatSession.id) }, { onSuccess: () => { success("Support request accepted."); navigate(`/admin/support/${chatSession.userId}`); } })}>Accept</Button>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target><ActionIcon variant="subtle" size={36} aria-label={`More actions for ${chatSession.user.fname}`}><MoreHorizontal size={17} /></ActionIcon></Menu.Target>
          <Menu.Dropdown><Menu.Label>Request actions</Menu.Label><Menu.Item color="red" leftSection={<XCircle size={15} />} disabled={update.isPending} onClick={() => update.mutate({ status: "rejected", chatId: String(chatSession.id) }, { onSuccess: () => success("Support request rejected.") })}>Reject request</Menu.Item></Menu.Dropdown>
        </Menu>
      </div>
    );
  }

  if (chatSession.status === "open") return <Button component={Link} to={`/admin/support/${chatSession.userId}`} size="xs" variant="light" color="brand">Open chat</Button>;
  return <span className="text-sm text-ink-muted">No action</span>;
};

export default SupportActions;
