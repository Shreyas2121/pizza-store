import type { ReactNode } from "react";
import { Alert, Button, Loader } from "@mantine/core";
import { usePromotionAccess } from "../api/promotion.queries";

export const PromotionRoute = ({
  children,
  manager = false,
}: {
  children: ReactNode;
  manager?: boolean;
}) => {
  const permissions = usePromotionAccess();
  if (permissions.access.isPending)
    return <Loader aria-label="Loading promotion permissions" />;
  if (permissions.access.isError)
    return (
      <Alert color="red">
        Promotion permissions could not be loaded.
        <Button
          variant="subtle"
          onClick={() => void permissions.access.refetch()}
        >
          Retry permissions
        </Button>
      </Alert>
    );
  if (!(manager ? permissions.manager : permissions.admin))
    return (
      <Alert color="red" title="Permission denied">
        {manager
          ? "Only a manager of the selected store can change its promotion participation."
          : "Only platform administrators can manage global promotions."}
      </Alert>
    );
  return children;
};
