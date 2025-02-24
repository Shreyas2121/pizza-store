import { Loader, Card, Text, Title, Button } from "@mantine/core";
import { useGetAddresses } from "../../hooks/user";
import { useAuthModalStore } from "../../store/modal";
import AddressForm from "../../components/address-form";

const Address = () => {
  const { data: addresses, isLoading } = useGetAddresses();
  const { openModal } = useAuthModalStore();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-pink-50 to-pink-100">
        <Loader size="lg" />
      </div>
    );
  }

  if (!addresses || addresses.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 to-pink-100 p-6">
        <Title order={3} className="mb-4">
          My Addresses
        </Title>
        <Text color="dimmed" className="mb-6">
          No addresses found
        </Text>
        <Button
          color="red"
          radius="md"
          onClick={() => openModal(<AddressForm />)}
        >
          Add New Address
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-pink-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Title order={3}>My Addresses</Title>
          <Button
            color="red"
            radius="md"
            onClick={() => openModal(<AddressForm />)}
          >
            Add Address
          </Button>
        </div>

        {/* Addresses Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {addresses.map((addr) => (
            <Card
              key={addr.id}
              shadow="md"
              radius="md"
              withBorder
              className="p-4 bg-white hover:shadow-lg transition-shadow"
            >
              <Text className="font-semibold mb-1">{addr.type} Address</Text>
              <div className="text-sm text-gray-600 space-y-1">
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
