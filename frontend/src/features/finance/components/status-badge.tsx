import { Badge } from "@mantine/core";
import { financeStatusColor, humanizeStatus } from "../model/finance.helpers";

export const StatusBadge = ({ value }: { value: string }) => (
  <Badge color={financeStatusColor(value)} variant="light">{humanizeStatus(value)}</Badge>
);
