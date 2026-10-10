import { useState } from "react";
import { Link, useParams } from "react-router";
import { ActionIcon, Alert, Badge, Button, NumberInput, Paper, Select, Switch, Text } from "@mantine/core";
import { Plus, Trash } from "lucide-react";
import { useAdminStores } from "@/features/store";
import { PageHeader, PanelSkeleton } from "@/shared/ui";
import { error, formatPaise, parseRupeesToPaise, success } from "@/shared/lib";
import { useGetProductsA } from "../api/product.queries";
import { useAdminBundle, usePublicBundle, useSaveBundle, type BundleDefinition } from "../api/bundle.queries";
import { bundleWriteSchema, type BundleWrite } from "../model/bundle.schemas";
import type { Product } from "../model/catalog.types";
import { BundleContents } from "../components/customer/bundle-merchandising";

type PriceRow = { storeId: number; selling: number | string; regular: number | string; isAvailable: boolean };

function BundleEditor({ id, definition, products, stores }: {
  id: number; definition: BundleDefinition | null; products: Product[]; stores: Array<{ id: number; name: string }>;
}) {
  const [components, setComponents] = useState<BundleWrite["components"]>(definition?.components.map(({ productId, quantityPerBundle }) => ({ productId, quantityPerBundle })) ?? []);
  const [prices, setPrices] = useState<PriceRow[]>(definition?.storePrices.map((price) => ({ storeId: price.storeId, selling: price.sellingPricePaise / 100, regular: price.compareAtPricePaise / 100, isAvailable: price.isAvailable })) ?? []);
  const [validation, setValidation] = useState<string | null>(null);
  const [previewStore, setPreviewStore] = useState<string | null>(null);
  const save = useSaveBundle(id, !!definition);
  const preview = usePublicBundle(id, Number(previewStore), !!definition);
  const singles = products.filter((product) => product.productType !== "bundle" && product.id !== id);
  const updatePrice = (index: number, changes: Partial<PriceRow>) => setPrices((rows) => rows.map((row, i) => i === index ? { ...row, ...changes } : row));
  const submit = () => {
    try {
      const parsed = bundleWriteSchema.safeParse({ components, storePrices: prices.map((price) => ({ storeId: price.storeId, sellingPricePaise: parseRupeesToPaise(price.selling), compareAtPricePaise: parseRupeesToPaise(price.regular), isAvailable: price.isAvailable })) });
      if (!parsed.success) { setValidation(parsed.error.issues.map((issue) => issue.message).join(" ")); return; }
      setValidation(null);
      save.mutate(parsed.data, { onSuccess: () => success("Bundle definition saved."), onError: () => error("Bundle could not be saved. Check the products and store prices, then try again.") });
    } catch { setValidation("Enter valid prices with no more than two decimal places."); }
  };
  return <div className="space-y-5">
    <Alert color="blue">Components must be single products. Each component must also be available at the store for customers to order this bundle.</Alert>
    <fieldset disabled={save.isPending} className="space-y-5">
      <Paper withBorder radius="lg" p="lg">
        <Text fw={700} size="lg">Bundle contents</Text><Text c="dimmed" size="sm" mb="lg">Choose up to 50 products, with 1–100 units of each per bundle.</Text>
        <div className="space-y-3">{components.map((component, index) => <div key={index} className="flex flex-wrap items-end gap-3">
          <Select className="min-w-48 flex-1" label={`Component ${index + 1}`} searchable value={component.productId ? String(component.productId) : null} data={singles.filter((product) => product.id === component.productId || !components.some((item) => item.productId === product.id)).map((product) => ({ value: String(product.id), label: product.name }))} onChange={(value) => setComponents((rows) => rows.map((row, i) => i === index ? { ...row, productId: Number(value) } : row))} />
          <NumberInput className="w-28" label="Quantity" min={1} max={100} allowDecimal={false} value={component.quantityPerBundle || ""} onChange={(value) => setComponents((rows) => rows.map((row, i) => i === index ? { ...row, quantityPerBundle: Number(value) } : row))} />
          <ActionIcon variant="light" color="red" size="lg" aria-label={`Remove component ${index + 1}`} onClick={() => setComponents((rows) => rows.filter((_, i) => i !== index))}><Trash size={16} /></ActionIcon>
        </div>)}</div>
        <Button mt="md" variant="light" leftSection={<Plus size={16} />} disabled={components.length >= 50 || components.length >= singles.length} onClick={() => setComponents((rows) => [...rows, { productId: 0, quantityPerBundle: 1 }])}>Add component</Button>
        {!singles.length && <Text mt="sm" c="dimmed">Create single products before adding bundle contents.</Text>}
      </Paper>
      <Paper withBorder radius="lg" p="lg">
        <Text fw={700} size="lg">Store pricing</Text><Text c="dimmed" size="sm" mb="lg">Prices are in rupees, up to ₹1,000. Regular price must exceed selling price. Switch availability off to stop selling at a store.</Text>
        <div className="space-y-4">{prices.map((price, index) => <div key={index} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
          <Select className="min-w-48 flex-1" label="Store" searchable value={price.storeId ? String(price.storeId) : null} disabled={!!definition?.storePrices.some((item) => item.storeId === price.storeId)} data={stores.filter((store) => store.id === price.storeId || !prices.some((item) => item.storeId === store.id)).map((store) => ({ value: String(store.id), label: store.name }))} onChange={(value) => updatePrice(index, { storeId: Number(value) })} />
          <NumberInput className="w-36" label="Selling price (₹)" min={0} max={1000} decimalScale={2} value={price.selling} onChange={(value) => updatePrice(index, { selling: value })} />
          <NumberInput className="w-36" label="Regular price (₹)" min={0.01} max={1000} decimalScale={2} value={price.regular} onChange={(value) => updatePrice(index, { regular: value })} />
          <Switch mb="xs" label="Available" checked={price.isAvailable} onChange={(event) => updatePrice(index, { isAvailable: event.currentTarget.checked })} />
          {!definition?.storePrices.some((item) => item.storeId === price.storeId) && <ActionIcon variant="light" color="red" size="lg" aria-label={`Remove store price ${index + 1}`} onClick={() => setPrices((rows) => rows.filter((_, i) => i !== index))}><Trash size={16} /></ActionIcon>}
        </div>)}</div>
        <Button mt="md" variant="light" leftSection={<Plus size={16} />} disabled={prices.length >= stores.length || prices.length >= 250} onClick={() => setPrices((rows) => [...rows, { storeId: 0, selling: "", regular: "", isAvailable: true }])}>Add store price</Button>
      </Paper>
    </fieldset>
    {validation && <Alert color="red" role="alert">{validation}</Alert>}
    <div className="flex justify-end gap-3"><Button component={Link} to="/admin/products" variant="default">Back to products</Button><Button onClick={submit} loading={save.isPending} disabled={!components.length || !prices.length}>{definition ? "Save changes" : "Create bundle definition"}</Button></div>
    {definition && <Paper withBorder radius="lg" p="lg">
      <Text fw={700} size="lg">Saved bundle preview</Text><Text c="dimmed" size="sm" mb="md">Check saved pricing and current component availability for a store.</Text>
      <Select label="Preview store" value={previewStore} onChange={setPreviewStore} data={definition.storePrices.map((price) => ({ value: String(price.storeId), label: stores.find((store) => store.id === price.storeId)?.name ?? `Store #${price.storeId}` }))} />
      {preview.isLoading ? <PanelSkeleton rows={2} label="Loading bundle preview" /> : preview.isError ? <Text c="red" mt="sm">Preview could not be loaded.</Text> : preview.data && <div className="mt-4"><Badge color={preview.data.isAvailable ? "basil" : "gray"}>{preview.data.isAvailable ? "Available" : "Unavailable"}</Badge><Text fw={700} mt="sm">{formatPaise(preview.data.sellingPricePaise ?? 0)}</Text><Text c="dimmed" td="line-through">{formatPaise(preview.data.compareAtPricePaise ?? 0)}</Text><BundleContents components={preview.data.components ?? []} /></div>}
    </Paper>}
  </div>;
}

export default function AdminBundlePage() {
  const id = Number(useParams().id);
  const definition = useAdminBundle(id);
  const products = useGetProductsA();
  const stores = useAdminStores();
  const product = products.data?.find((item) => item.id === id);
  if (!Number.isInteger(id) || id <= 0) return <Alert color="red">Invalid bundle product.</Alert>;
  if (definition.isLoading || products.isLoading || stores.isLoading) return <><PageHeader title="Bundle" /><PanelSkeleton form rows={5} label="Loading bundle editor" /></>;
  if (definition.isError || products.isError || stores.isError) return <Alert color="red">Bundle editor could not be loaded.<Button ml="sm" variant="default" onClick={() => { definition.refetch(); products.refetch(); stores.refetch(); }}>Retry</Button></Alert>;
  if (product?.productType !== "bundle") return <Alert color="red">Bundle product not found.</Alert>;
  return <div className="mx-auto max-w-5xl"><PageHeader eyebrow="Catalogue" title={product.name} description="Manage bundle contents, store prices, and availability." /><BundleEditor key={id} id={id} definition={definition.data ?? null} products={products.data ?? []} stores={stores.data ?? []} /></div>;
}
