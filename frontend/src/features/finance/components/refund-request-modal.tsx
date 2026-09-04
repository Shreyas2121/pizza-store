import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Checkbox, Group, Modal, NumberInput, Select, Stack, Text, Textarea } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import { API } from "@/shared/api";
import type { OrderRes } from "@/features/orders";
import { error, formatPaise, success } from "@/shared/lib";
import { useRequestRefund } from "../api/finance.queries";
import { apiMessage } from "../model/finance.helpers";

export const RefundRequestModal = ({ opened, onClose }: { opened: boolean; onClose: () => void }) => {
  const [orderId, setOrderId] = useState<number | string>("");
  const [lookupOrderId, setLookupOrderId] = useState<number | null>(null);
  const [orderItemId, setOrderItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [amountRupees, setAmountRupees] = useState<number | string>("");
  const [reasonCode, setReasonCode] = useState("customer_request");
  const [reasonNote, setReasonNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const requestRefund = useRequestRefund();
  const order = useQuery({
    queryKey: ["finance", "refund-order", lookupOrderId],
    queryFn: async () => (await API.get<{ data: OrderRes }>(`/order/${lookupOrderId}`)).data.data,
    enabled: Boolean(lookupOrderId),
    retry: false,
  });
  const amountPaise = typeof amountRupees === "number" ? Math.round(amountRupees * 100) : 0;
  const selectedItem = order.data?.items.find((item) => String(item.id) === orderItemId);
  const quantityNumber = typeof quantity === "number" ? quantity : 0;
  const valid = Boolean(selectedItem && quantityNumber > 0 && quantityNumber <= selectedItem.quantity && amountPaise > 0 && confirmed);

  const close = () => {
    setLookupOrderId(null); setOrderId(""); setOrderItemId(null); setAmountRupees("");
    setReasonNote(""); setConfirmed(false); onClose();
  };

  const submit = async () => {
    if (!lookupOrderId || !selectedItem || !valid) return;
    try {
      await requestRefund.mutateAsync({
        orderId: lookupOrderId,
        idempotencyKey: crypto.randomUUID(),
        amountPaise,
        reasonCode,
        reasonNote: reasonNote.trim() || undefined,
        allocations: [{ orderItemId: selectedItem.id, quantity: quantityNumber, allocatedPaise: amountPaise }],
      });
      success(`Refund request for ${formatPaise(amountPaise)} was created.`);
      close();
    } catch (cause) { error(apiMessage(cause)); }
  };

  return <Modal opened={opened} onClose={close} title="Request a refund" size="lg" centered><Stack>
    <Group align="end" grow><NumberInput label="Order ID" min={1} value={orderId} onChange={setOrderId} allowDecimal={false} /><Button variant="default" loading={order.isFetching} onClick={() => { const parsed = Number(orderId); if (Number.isInteger(parsed) && parsed > 0) setLookupOrderId(parsed); }}>Load order</Button></Group>
    {order.isError && <Alert color="red" icon={<AlertTriangle size={17} />}>Order could not be loaded or is outside your store access.</Alert>}
    {order.data && <>
      <Alert color="blue" title={`Order #${order.data.id}`}>Order total {formatPaise(Math.round(order.data.totalPrice * 100))}. The server will verify captured balance, quantities, tax, and prior refunds.</Alert>
      <Select label="Item to refund" placeholder="Choose an order item" value={orderItemId} onChange={(value) => { setOrderItemId(value); setConfirmed(false); }} data={order.data.items.map((item) => ({ value: String(item.id), label: `${item.product.name} · ${item.quantity} × ${formatPaise(Math.round(item.price * 100))}` }))} />
      <Group grow align="start"><NumberInput label="Quantity" min={1} max={selectedItem?.quantity ?? 1} value={quantity} onChange={(value) => { setQuantity(value); setConfirmed(false); }} allowDecimal={false} /><NumberInput label="Exact refund amount" prefix="₹" min={0.01} decimalScale={2} fixedDecimalScale value={amountRupees} onChange={(value) => { setAmountRupees(value); setConfirmed(false); }} /></Group>
      <Select label="Reason" value={reasonCode} onChange={(value) => value && setReasonCode(value)} data={[{ value: "customer_request", label: "Customer request" }, { value: "quality_issue", label: "Quality issue" }, { value: "missing_item", label: "Missing item" }, { value: "delivery_issue", label: "Delivery issue" }]} />
      <Textarea label="Internal note" value={reasonNote} onChange={(event) => setReasonNote(event.currentTarget.value)} maxLength={1000} />
      <Card withBorder bg="var(--mantine-color-gray-0)"><Text fw={700}>Irreversible-action summary</Text><Text size="sm" mt="xs">Request {formatPaise(amountPaise)} for {quantityNumber || 0} × {selectedItem?.product.name ?? "selected item"} on order #{lookupOrderId}. Approval is separate and inventory will not be returned automatically.</Text><Checkbox mt="md" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} label="I checked the order, item quantity, reason, and exact refund amount." /></Card>
      <Button onClick={submit} disabled={!valid} loading={requestRefund.isPending}>Create refund request</Button>
    </>}
  </Stack></Modal>;
};
