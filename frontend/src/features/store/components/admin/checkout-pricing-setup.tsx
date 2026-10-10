import { Alert, Button, Card, Stack, Text } from "@mantine/core";
import axios from "axios";
import { error, success } from "@/shared/lib";
import { PanelSkeleton } from "@/shared/ui";
import { useCheckoutPricing, useInitializeCheckoutPricing } from "../../api/store.queries";

const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);

export function CheckoutPricingSetup({ storeId }: { storeId: number }) {
  const query = useCheckoutPricing(storeId);
  const initialize = useInitializeCheckoutPricing(storeId);
  if (query.isLoading) return <PanelSkeleton label="Loading checkout pricing" />;
  if (query.isError || !query.data) return <Alert color="red" title="Checkout pricing unavailable">
    <Text>Please retry loading this store's checkout pricing.</Text>
    <Button variant="subtle" onClick={() => query.refetch()}>Retry</Button>
  </Alert>;
  const pricing = query.data;
  const overlap = [pricing.deliveryRules, pricing.itemTaxRules, pricing.deliveryTaxRules].some((rules) => rules.length > 1);
  const initializeMissing = () => initialize.mutate(undefined, {
    onSuccess: () => success("Checkout pricing is ready. Refresh the customer cart to request a new quote."),
    onError: (cause) => error(axios.isAxiosError(cause) && typeof cause.response?.data?.message === "string" ? cause.response.data.message : "Checkout pricing could not be initialized. Please retry."),
  });
  return <Stack>
    <Text size="sm">Store business date: {pricing.businessDate} ({pricing.timezone}). Date ranges include both their start and end dates.</Text>
    <Alert color={pricing.ready ? "green" : "orange"} title={pricing.ready ? "Checkout pricing ready" : "Checkout pricing needs attention"}>
      {pricing.ready ? "One delivery rule and both demo tax rules apply today." : overlap ? "Overlapping rules need to be resolved before defaults can be initialized." : "Initialize the missing rules below to enable cart quotes. Existing applicable rules will be preserved."}
    </Alert>
    <Card withBorder><Text fw={600}>Delivery pricing</Text>
      {pricing.deliveryRules.length === 0 ? <Text size="sm">Missing. Default: {money(pricing.defaults.deliveryFeePaise)}, free from {money(pricing.defaults.freeDeliveryThresholdPaise)}.</Text> : pricing.deliveryRules.map((rule) => <Text key={rule.id} size="sm">Version {rule.version}: {money(rule.deliveryFeePaise)}; {rule.freeDeliveryThresholdPaise === null ? "no free delivery threshold" : `free from ${money(rule.freeDeliveryThresholdPaise)}`}. Effective {rule.effectiveFrom} through {rule.effectiveTo ?? "no end date"}.</Text>)}
    </Card>
    {([['Item demo tax', pricing.itemTaxRules, pricing.defaults.itemTaxRateBps], ['Delivery demo tax', pricing.deliveryTaxRules, pricing.defaults.deliveryTaxRateBps]] as const).map(([label, rules, rate]) => <Card withBorder key={label}>
      <Text fw={600}>{label}</Text>{rules.length === 0 ? <Text size="sm">Missing. Default inclusive rate: {rate / 100}%.</Text> : rules.map((rule) => <Text size="sm" key={rule.id}>Version {rule.version}: {rule.rateBps / 100}% inclusive. Effective {rule.effectiveFrom} through {rule.effectiveTo ?? "no end date"}.</Text>)}
    </Card>)}
    <Text size="sm" c="dimmed">Portfolio demo — not a statutory tax invoice. Missing defaults start on today's store business date and end before any future scheduled rule. Historical and current rules are preserved.</Text>
    {!pricing.ready && <Button disabled={overlap} loading={initialize.isPending} onClick={initializeMissing}>Initialize missing demo rules</Button>}
  </Stack>;
}
