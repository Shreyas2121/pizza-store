import { useParams } from "react-router";
import { useGetOrder } from "../../../hooks/order";
import { Loader, Badge, Card, Title, Text } from "@mantine/core";
import { format } from "date-fns"; // optional for date formatting
import OrderStatus from "../../../components/common/order-status";
import OrderAddress from "@/components/common/order-address";
import OrderCoupon from "@/components/common/order-coupon";
import OrderItems from "@/components/common/order-items";

const OrderDetails = () => {
  const { id } = useParams();
  const { data: order, isLoading, isError } = useGetOrder(parseInt(id!, 10));

  // Handle loading
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader size="lg" />
      </div>
    );
  }

  // Handle error or no data
  if (isError || !order) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load order details.</p>
      </div>
    );
  }

  // Format date if it exists
  const orderDate = order.orderDate
    ? format(new Date(order.orderDate), "PPP p")
    : "N/A";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Page header */}
      <div className="text-center space-y-2">
        <Title order={2}>Order #{order.id}</Title>
        <Text c="dimmed">Placed on {orderDate}</Text>
      </div>

      {/* Order summary card */}
      <Card shadow="sm" radius="md" p="lg" withBorder>
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
          <div>
            <Text fw={500} size="lg">
              Order Status
            </Text>

            <OrderStatus status={order.status} />
          </div>

          <div>
            <Text fw={500} size="lg">
              Payment Status
            </Text>
            <Badge color="orange" variant="light" mt={4}>
              {order.payment?.status ?? "Unknown"}
            </Badge>
          </div>

          <div>
            <Text fw={500} size="lg">
              Payment Type
            </Text>
            <Text mt={4}>{order.paymentType}</Text>
          </div>

          <div>
            <Text fw={500} size="lg">
              Total Price
            </Text>
            <Text mt={4} size="xl" fw={700}>
              ₹{order.totalPrice.toFixed(2)}
            </Text>
          </div>
        </div>
      </Card>

      <OrderAddress address={order.address} />

      {/* Coupon details (if any) */}
      {order.coupon && <OrderCoupon coupon={order.coupon} />}

      {/* Ordered items */}
      <OrderItems items={order.items} />
    </div>
  );
};

export default OrderDetails;
