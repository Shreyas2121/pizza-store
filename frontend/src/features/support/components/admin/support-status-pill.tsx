import { Badge } from "@mantine/core";
import { CheckCircle2, Clock3, MessageCircle, XCircle } from "lucide-react";
import { ChatStatus } from "../../model/support.types";

const statusMeta = {
  pending: { label: "Waiting", color: "yellow", Icon: Clock3 },
  open: { label: "Open", color: "basil", Icon: MessageCircle },
  close: { label: "Closed", color: "gray", Icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "red", Icon: XCircle },
} as const;

export const SupportStatusPill = ({ status }: { status: ChatStatus }) => {
  const { label, color, Icon } = statusMeta[status];
  return (
    <Badge color={color} variant="light" leftSection={<Icon size={13} />}>
      {label}
    </Badge>
  );
};

export default SupportStatusPill;
