import axios from "axios";
import { Alert, Badge, Button, Card, Drawer, Group, Loader, Stack, Text } from "@mantine/core";
import { formatDateTime, formatPaise } from "@/shared/lib";
import { useProductInventory } from "../api/inventory.queries";
import type { InventoryItem } from "../model/inventory.types";

type DetailProps = {
  storeId: number;
  productId: number;
  onHistory: (item: InventoryItem) => void;
};

export function InventoryDetailContent({ storeId, productId, onHistory }: DetailProps) {
  const inventory = useProductInventory(storeId, productId);
  if (inventory.isLoading) return <Loader aria-label="Loading product inventory" />;
  if (inventory.isError || !inventory.data) {
    const missing = axios.isAxiosError(inventory.error) && inventory.error.response?.status === 404;
    return <Alert color="red" title={missing ? "Product inventory not found" : "Inventory unavailable"}>
      {missing ? "This product may no longer be mapped to the selected store." : "Stock details could not be loaded."}
      <Button variant="subtle" onClick={() => inventory.refetch()}>Retry</Button>
    </Alert>;
  }
  const item = inventory.data;
  const tracked = item.onHandQuantity !== null;
  return <Stack>
    <Group justify="space-between">
      <Text fw={700}>{item.productName}</Text>
      <Button variant="light" size="xs" loading={inventory.isFetching} onClick={() => inventory.refetch()}>Refresh stock</Button>
    </Group>
    <Group><Badge color={item.stockStatus === "out_of_stock" ? "red" : item.stockStatus === "low_stock" ? "yellow" : "blue"}>{item.stockStatus.replace(/_/g, " ")}</Badge>
      {(!item.isAvailable || !item.productIsAvailable) && <Badge color="gray">Manually unavailable</Badge>}
    </Group>
    {!tracked && <Alert color="gray">Stock is untracked for this product. Quantities have not been configured.</Alert>}
    <div className="grid grid-cols-2 gap-3">
      {[["On-hand", item.onHandQuantity], ["Reserved", item.reservedQuantity], ["Available", item.availableQuantity], ["Low-stock threshold", item.lowStockThreshold]].map(([label, value]) => <Card withBorder key={String(label)}><Text size="sm" c="dimmed">{label}</Text><Text fw={700}>{value ?? "Untracked"}</Text></Card>)}
    </div>
    <Text size="sm">Available stock accounts for active reservations.</Text>
    <Text size="sm">Store price: {formatPaise(item.pricePaise)}</Text>
    <Text size="sm">Last restocked: {item.lastRestockedAt ? formatDateTime(item.lastRestockedAt) : "Never"}</Text>
    <Button variant="default" onClick={() => onHistory(item)}>Movement history</Button>
  </Stack>;
}

export function InventoryDetailDrawer(props: DetailProps & { onClose: () => void }) {
  return <Drawer opened onClose={props.onClose} position="right" size="lg" title="Product inventory" overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}>
    <InventoryDetailContent {...props} />
  </Drawer>;
}
