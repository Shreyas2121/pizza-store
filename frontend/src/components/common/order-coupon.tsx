import { Coupon } from "@/lib/types";
import { Card, Text, Title } from "@mantine/core";

const OrderCoupon = ({ coupon }: { coupon: Coupon }) => {
  return (
    <Card shadow="sm" radius="md" p="lg" withBorder>
      <Title order={4} mb="xs">
        Applied Coupon
      </Title>
      <Text>
        <span className="font-medium text-gray-700">Code:</span>{" "}
        {coupon.code}
      </Text>
      <Text>
        <span className="font-medium text-gray-700">Type:</span>{" "}
        {coupon.discountType}
      </Text>
      <Text>
        <span className="font-medium text-gray-700">Value:</span>{" "}
        {coupon.discountValue}
      </Text>
    </Card>
  );
};

export default OrderCoupon;
