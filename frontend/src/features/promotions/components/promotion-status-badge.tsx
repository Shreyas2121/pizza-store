import { Badge } from "@mantine/core";
import type { PromotionStatus } from "../model/promotion.types";

const colors: Record<PromotionStatus, string> = {
  active: "green",
  scheduled: "blue",
  expired: "gray",
  exhausted: "orange",
  inactive: "gray",
};
export const PromotionStatusBadge = ({
  status,
}: {
  status: PromotionStatus;
}) => <Badge color={colors[status]}>{status}</Badge>;
