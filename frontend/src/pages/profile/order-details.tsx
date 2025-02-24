import { useParams } from "react-router";
import { useGetOrder } from "../../hooks/order";
import { Loader, Badge, Card, Title, Text, Paper } from "@mantine/core";
import { format } from "date-fns"; // optional for date formatting
import OrderStatus from "../../components/order-status";

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

      {/* Delivery Address card (only if address exists) */}
      {order.address && (
        <Card shadow="sm" radius="md" p="lg" withBorder>
          <Title order={4} mb="xs">
            Delivery Address
          </Title>
          <Text>
            {order.address.street}, {order.address.city}
          </Text>
          <Text>
            {order.address.state} – {order.address.pincode}
          </Text>
          <Text>Phone: {order.address.phone}</Text>
        </Card>
      )}

      {/* Coupon details (if any) */}
      {order.coupon && (
        <Card shadow="sm" radius="md" p="lg" withBorder>
          <Title order={4} mb="xs">
            Applied Coupon
          </Title>
          <Text>
            <span className="font-medium text-gray-700">Code:</span>{" "}
            {order.coupon.code}
          </Text>
          <Text>
            <span className="font-medium text-gray-700">Type:</span>{" "}
            {order.coupon.discountType}
          </Text>
          <Text>
            <span className="font-medium text-gray-700">Value:</span>{" "}
            {order.coupon.discountValue}
          </Text>
        </Card>
      )}

      {/* Ordered items */}
      <Paper shadow="sm" radius="md" p="lg" withBorder className="w-full">
        <Title order={4} mb="md">
          Order Items
        </Title>
        {order.items.length === 0 ? (
          <Text>No items found for this order.</Text>
        ) : (
          /* Tailwind-only table */
          <div className="overflow-x-auto w-full">
            <table className="min-w-full table-auto border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 font-medium text-gray-700 text-left">
                    Product
                  </th>
                  <th className="py-3 px-4 font-medium text-gray-700 text-left">
                    Customizations
                  </th>
                  <th className="py-3 px-4 font-medium text-gray-700 text-left">
                    Qty
                  </th>
                  <th className="py-3 px-4 font-medium text-gray-700 text-left">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 px-4">
                      <span className="font-semibold">{item.product.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      {item.options && item.options.length > 0 ? (
                        <ul className="list-disc list-inside text-sm text-gray-600">
                          {item.options.map((opt) => (
                            <li key={opt.id}>{opt.name}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-gray-400">
                          No customizations
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">{item.quantity}</td>
                    <td className="py-3 px-4">₹{item.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Paper>
    </div>
  );
};

export default OrderDetails;
