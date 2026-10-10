import { useState } from "react";
import { Alert, Button, Card, Group, NumberInput, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { useStoreProducts } from "@/features/store";
import { formatDate, formatPaise } from "@/shared/lib";
import { EmptyState, TableSkeleton } from "@/shared/ui";
import { error, success } from "@/shared/lib/notifications";
import { apiMessage } from "../model/finance.helpers";
import { useCreateProductCost, useProductCosts } from "../api/finance.queries";

const today = () => new Date().toISOString().slice(0, 10);

export const CostsPanel = ({ storeId, canManage }: { storeId: number; canManage: boolean }) => {
  const costs = useProductCosts(storeId);
  const products = useStoreProducts(storeId);
  const create = useCreateProductCost();
  const [storeProductId, setStoreProductId] = useState<string | null>(null);
  const [unitCost, setUnitCost] = useState<string | number>(0);
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [source, setSource] = useState("Owner standard-cost review");
  const save = async () => {
    if (!storeProductId || typeof unitCost !== "number" || !Number.isInteger(unitCost)) return;
    try {
      await create.mutateAsync({ storeId, storeProductId: Number(storeProductId), unitCostPaise: unitCost, effectiveFrom, source: source.trim() });
      success("Standard-cost version added. Existing history remains unchanged.");
      setStoreProductId(null); setUnitCost(0);
    } catch (cause) { error(apiMessage(cause)); }
  };
  return <Stack>
    <Alert color="blue" title="Historical source snapshots">Changing a standard cost creates an effective-dated version. Delivered order lines keep their original cost snapshot.</Alert>
    {canManage && <Card withBorder>
      <Text fw={700}>Add standard-cost version</Text>
      <Group grow align="end" mt="sm">
        <Select searchable label="Store product" placeholder="Choose product" value={storeProductId} onChange={setStoreProductId} data={(products.data ?? []).map((item) => ({ value: String(item.id), label: item.product.name }))} />
        <NumberInput label="Unit cost (paise)" min={0} allowDecimal={false} value={unitCost} onChange={setUnitCost} />
        <TextInput type="date" label="Effective from" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.currentTarget.value)} />
      </Group>
      <TextInput mt="sm" label="Source / rationale" value={source} onChange={(event) => setSource(event.currentTarget.value)} maxLength={255} />
      <Button mt="sm" loading={create.isPending} disabled={!storeProductId || typeof unitCost !== "number" || !effectiveFrom || !source.trim()} onClick={save}>Add version</Button>
    </Card>}
    {costs.isLoading ? <TableSkeleton toolbar={false} label="Loading standard costs" /> : costs.isError ? <Alert color="red">Standard-cost history could not be loaded.</Alert> : !costs.data?.length ? <EmptyState title="No standard costs" description="Add an effective cost before delivering orders for complete source-margin coverage." /> : <Card withBorder><Text fw={700}>Cost history</Text><div className="mt-3 overflow-x-auto"><Table withTableBorder><Table.Thead><Table.Tr><Table.Th>Product</Table.Th><Table.Th>Unit cost</Table.Th><Table.Th>Effective range</Table.Th><Table.Th>Source</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{costs.data.map((row) => <Table.Tr key={row.cost.id}><Table.Td>{row.productName}</Table.Td><Table.Td className="tabular-nums">{formatPaise(row.cost.unitCostPaise)}</Table.Td><Table.Td>{formatDate(row.cost.effectiveFrom)} – {row.cost.effectiveTo ? formatDate(row.cost.effectiveTo) : "open"}</Table.Td><Table.Td>{row.cost.source}</Table.Td></Table.Tr>)}</Table.Tbody></Table></div></Card>}
  </Stack>;
};
