import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Checkbox, Group, Modal, NumberInput, Select, Stack, Text, Textarea } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import { API } from "@/shared/api";
import type { OrderRes } from "@/features/orders";
import { error, formatPaise, success } from "@/shared/lib";
import { useRequestRefund } from "../api/finance.queries";
import { apiMessage } from "../model/finance.helpers";
import { buildRefundDraft } from "../model/refund-draft";

export const RefundRequestModal = ({ opened, onClose }: { opened: boolean; onClose: () => void }) => {
  const [orderId, setOrderId] = useState<number | string>("");
  const [lookupOrderId, setLookupOrderId] = useState<number | null>(null);
  const [orderItemId, setOrderItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [amountRupees, setAmountRupees] = useState<number | string>("");
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [deliveryAmountRupees, setDeliveryAmountRupees] = useState<number | string>("");
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
  const selectedItem = order.data?.items.find((item) => String(item.id) === orderItemId);
  const quantityNumber = typeof quantity === "number" ? quantity : 0;
  let draft: ReturnType<typeof buildRefundDraft> | null = null;
  let validationMessage = "";
  if (order.data) {
    try {
      draft = buildRefundDraft(order.data, { orderItemId, quantity, itemAmountRupees: amountRupees, includeDelivery, deliveryAmountRupees });
    } catch (cause) { validationMessage = cause instanceof Error ? cause.message : "Check refund amounts."; }
  }
  const amountPaise = draft?.amountPaise ?? 0;
  const valid = Boolean(draft && confirmed && !order.isFetching);

  const resetAllocations = () => {
    setOrderItemId(null); setAmountRupees(""); setQuantity(1);
    setIncludeDelivery(false); setDeliveryAmountRupees(""); setConfirmed(false);
  };

  const close = () => {
    setLookupOrderId(null); setOrderId(""); resetAllocations();
    setReasonNote(""); onClose();
  };

  const submit = async () => {
    if (!lookupOrderId || !draft || !valid) return;
    try {
      await requestRefund.mutateAsync({
        orderId: lookupOrderId,
        idempotencyKey: crypto.randomUUID(),
        amountPaise,
        reasonCode,
        reasonNote: reasonNote.trim() || undefined,
        allocations: draft.allocations,
      });
      success(`Refund request for ${formatPaise(amountPaise)} was created.`);
      close();
    } catch (cause) { error(apiMessage(cause)); }
  };

  return <Modal opened={opened} onClose={close} title="Request a refund" size="lg" centered><Stack>
    <Group align="end" grow><NumberInput label="Order ID" min={1} value={orderId} onChange={(value) => { setOrderId(value); setLookupOrderId(null); resetAllocations(); }} allowDecimal={false} /><Button variant="default" loading={order.isFetching} onClick={() => { const parsed = Number(orderId); if (Number.isInteger(parsed) && parsed > 0) { resetAllocations(); setLookupOrderId(parsed); } }}>Load order</Button></Group>
    {order.isError && <Alert color="red" icon={<AlertTriangle size={17} />}>Order could not be loaded or is outside your store access.</Alert>}
    {order.data && <>
      <Alert color="blue" title={`Order #${order.data.id}`}>Order total {formatPaise(order.data.grandTotalPaise)}. The server will verify captured balance, quantities, tax, and prior refunds.</Alert>
      <Select clearable label="Item to refund" description="Optional for a delivery-only refund. Item amounts include paid tax and discounts." placeholder="Choose an order item" value={orderItemId} onChange={(value) => { setOrderItemId(value); setQuantity(1); setAmountRupees(""); setConfirmed(false); }} data={order.data.items.map((item) => ({ value: String(item.id), label: `${item.product.name} · ${item.quantity} × ${formatPaise(item.unitPricePaise)}` }))} />
      {selectedItem && <Group grow align="start"><NumberInput label="Quantity" min={1} max={selectedItem.quantity} value={quantity} onChange={(value) => { setQuantity(value); setConfirmed(false); }} allowDecimal={false} /><NumberInput label="Item refund amount" description={`Paid item total: ${formatPaise(selectedItem.lineTotalPaise)}. Excludes delivery.`} prefix="₹" min={0.01} decimalScale={2} fixedDecimalScale value={amountRupees} onChange={(value) => { setAmountRupees(value); setConfirmed(false); }} /></Group>}
      <Checkbox checked={includeDelivery} disabled={order.data.chargedDeliveryFeePaise <= 0} onChange={(event) => { setIncludeDelivery(event.currentTarget.checked); setDeliveryAmountRupees(event.currentTarget.checked ? order.data!.chargedDeliveryFeePaise / 100 : ""); setConfirmed(false); }} label={`Refund delivery charge (${formatPaise(order.data.chargedDeliveryFeePaise)} paid, including tax)`} />
      {includeDelivery && <NumberInput label="Delivery refund amount" prefix="₹" min={0.01} decimalScale={2} fixedDecimalScale value={deliveryAmountRupees} onChange={(value) => { setDeliveryAmountRupees(value); setConfirmed(false); }} />}
      {validationMessage && (amountRupees !== "" || includeDelivery) && <Alert color="red">{validationMessage}</Alert>}
      <Select label="Reason" value={reasonCode} onChange={(value) => value && setReasonCode(value)} data={[{ value: "customer_request", label: "Customer request" }, { value: "quality_issue", label: "Quality issue" }, { value: "missing_item", label: "Missing item" }, { value: "delivery_issue", label: "Delivery issue" }]} />
      <Textarea label="Internal note" value={reasonNote} onChange={(event) => setReasonNote(event.currentTarget.value)} maxLength={1000} />
      <Card withBorder bg="var(--mantine-color-gray-0)"><Text fw={700}>Total refund: {formatPaise(amountPaise)}</Text><Text size="sm" mt="xs">{selectedItem ? `${quantityNumber || 0} × ${selectedItem.product.name}` : "No item refund"}{includeDelivery ? " plus delivery charge" : " (delivery excluded)"} on order #{lookupOrderId}. Approval is separate and inventory will not be returned automatically. The server verifies prior refunds and the remaining captured balance.</Text><Checkbox mt="md" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} label="I checked the item and delivery amounts, quantity, and reason." /></Card>
      <Button onClick={submit} disabled={!valid} loading={requestRefund.isPending}>Create refund request</Button>
    </>}
  </Stack></Modal>;
};
