import { Button } from "@mantine/core";
import { Edit, Trash } from "lucide-react";

export const ProductActions = () => {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" leftSection={<Edit size={16} />}>
        Edit
      </Button>
      <Button
        size="sm"
        variant="light"
        color="red"
        leftSection={<Trash size={16} />}
      >
        Delete
      </Button>
    </div>
  );
};

export default ProductActions;
