import { OrderItemRes } from "@/lib/types";
import { Paper, Text, Title } from "@mantine/core";

const OrderItems = ({ items }: { items: OrderItemRes[] }) => {
  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder className="w-full">
        <Title order={4} mb="md">
          Order Items
        </Title>
        {items.length === 0 ? (
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
                {items.map((item) => (
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
  )
};

export default OrderItems;
