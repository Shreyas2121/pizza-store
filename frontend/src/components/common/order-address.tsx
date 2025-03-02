import { Address } from "@/lib/types";
import { Card, Text, Title } from "@mantine/core";

const OrderAddress = ({ address }: { address: Address }) => {
  return (
    <Card shadow="sm" radius="md" p="lg" withBorder>
      <Title order={4} mb="xs">
        Delivery Address
      </Title>
      <Text>
        {address.street}, {address.city}
      </Text>
      <Text>
        {address.state} – {address.pincode}
      </Text>
      <Text>Phone: {address.phone}</Text>
    </Card>
  );
};

export default OrderAddress;
