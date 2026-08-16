import { AddressForm } from "@/components/main";
import { PageHeader } from "@/components/common";
import { USER_API_HOOKS } from "@/hooks";
import { useAuthModalStore } from "@/store";
import { Loader, Card, Text, Button } from "@mantine/core";
import { Plus } from "lucide-react";

const Address = () => {
  const { data: addresses, isLoading } = USER_API_HOOKS.useGetAddresses();
  const { openModal } = useAuthModalStore();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12 bg-canvas">
        <Loader size="lg" />
      </div>
    );
  }

  if (!addresses || addresses.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center bg-canvas p-6">
        <PageHeader
          eyebrow="Account Settings"
          title="My Addresses"
          description="Manage your delivery locations for faster checkout."
        />
        <Text c="dimmed" className="mb-6">
          No addresses found
        </Text>
        <Button
          color="brand"
          radius="md"
          leftSection={<Plus size={16} />}
          onClick={() =>
            openModal({
              content: <AddressForm />,
              title: "",
            })
          }
        >
          Add New Address
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-canvas p-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          eyebrow="Account Settings"
          title="My Addresses"
          description="Manage your delivery locations for faster checkout."
          action={
            <Button
              color="brand"
              radius="md"
              leftSection={<Plus size={16} />}
              onClick={() =>
                openModal({
                  content: <AddressForm />,
                  title: "",
                })
              }
            >
              Add Address
            </Button>
          }
        />

        {/* Addresses Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {addresses.map((addr) => (
            <Card
              key={addr.id}
              shadow="sm"
              radius="lg"
              withBorder
              className="p-4 bg-surface border-border hover:shadow-md transition-shadow"
            >
              <Text className="font-semibold mb-1 text-ink">{addr.type} Address</Text>
              <div className="text-sm text-ink-muted space-y-1">
                <Text>
                  {addr.street}, {addr.city}, {addr.state}
                </Text>
                <Text>Pincode: {addr.pincode}</Text>
                <Text>Phone: {addr.phone}</Text>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Address;
