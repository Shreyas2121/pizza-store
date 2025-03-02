import CreateMenuItem from "@/components/admin/menu/create-menu-item";
import { useGetMenuItems } from "@/hooks/menu";
import { BASE_URL } from "@/lib/constants";
import { useAuthModalStore } from "@/store/modal";
import { Button, Card, Loader, Text } from "@mantine/core";
import { Edit, Trash } from "lucide-react";

const Menu = () => {
  const { data: menuItems, isLoading } = useGetMenuItems();
  const { openModal } = useAuthModalStore();

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-8">
        <Text className="text-2xl font-semibold mb-4">Menu Items</Text>{" "}
        <Button
          onClick={() =>
            openModal({
              content: <CreateMenuItem />,
              title: "Create New Menu Item",
            })
          }
          size="sm"
          variant="primary"
        >
          Add New Item
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {menuItems!.map((item) => (
          <Card
            key={item.id}
            shadow="sm"
            radius="md"
            className="p-4 flex flex-col items-center"
          >
            <img
              src={`${BASE_URL}${item.image}`}
              alt={item.name}
              className="w-24 h-24 object-cover rounded mb-4 border"
            />
            <Text className="font-semibold text-lg mb-1">{item.name}</Text>
            <Text className="text-sm text-gray-500 mb-4">
              Position: {item.position}
            </Text>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="xs"
                leftSection={<Edit size={14} />}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="xs"
                color="red"
                leftSection={<Trash size={14} />}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Menu;
