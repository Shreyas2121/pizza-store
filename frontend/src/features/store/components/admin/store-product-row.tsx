import { useEffect, useState } from "react";
import { Button, NumberInput, Switch } from "@mantine/core";
import { modals } from "@mantine/modals";
import { Save, Trash2 } from "lucide-react";
import { BASE_URL } from "@/shared/config";
import { APP_CURRENCY_SYMBOL, error, formatPaise, parseRupeesToPaise, success } from "@/shared/lib";
import { useRemoveStoreProduct, useUpdateStoreProduct } from "../../api/store.queries";
import type { StoreProduct } from "../../model/store.types";
import { buildStoreProductUpdate } from "../../model/store-product-update";

interface StoreProductRowProps {
  mapping: StoreProduct;
  canUpdatePrice: boolean;
  canUpdateAvailability: boolean;
  canRemove: boolean;
}

export function StoreProductRow({ mapping, canUpdatePrice, canUpdateAvailability, canRemove }: StoreProductRowProps) {
  const [price, setPrice] = useState<number | string>(mapping.pricePaise / 100);
  const [available, setAvailable] = useState(mapping.isAvailable);
  const updateProduct = useUpdateStoreProduct(mapping.storeId);
  const removeProduct = useRemoveStoreProduct(mapping.storeId);
  const nextPricePaise = price === "" ? mapping.pricePaise : parseRupeesToPaise(price);
  const update = buildStoreProductUpdate(
    { pricePaise: mapping.pricePaise, isAvailable: mapping.isAvailable },
    { pricePaise: nextPricePaise, isAvailable: available },
    { canUpdatePrice, canUpdateAvailability },
  );
  const changed = Object.keys(update).length > 0;

  useEffect(() => {
    setPrice(mapping.pricePaise / 100);
    setAvailable(mapping.isAvailable);
  }, [mapping.isAvailable, mapping.pricePaise]);

  const save = () => updateProduct.mutate({ productId: mapping.productId, data: update }, {
    onSuccess: () => success(`${mapping.product.name} updated.`),
    onError: () => error("Product mapping could not be updated."),
  });

  const confirmRemove = () => modals.openConfirmModal({
    title: `Remove ${mapping.product.name}?`,
    children: <p className="text-sm text-ink-muted">This product will no longer appear in this store’s menu.</p>,
    labels: { confirm: "Remove product", cancel: "Cancel" },
    confirmProps: { color: "red" },
    centered: true,
    onConfirm: () => removeProduct.mutate(mapping.productId, {
      onSuccess: () => success("Product removed from store."),
      onError: () => error("Product could not be removed."),
    }),
  });

  return (
    <div className="grid gap-4 border-b border-border p-4 last:border-b-0 md:grid-cols-[minmax(240px,1fr)_150px_150px_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <img src={`${BASE_URL}${mapping.product.image}`} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />
        <div className="min-w-0"><p className="truncate font-semibold text-ink">{mapping.product.name}</p><p className="text-xs text-ink-muted">Global price {formatPaise(mapping.product.pricePaise)}</p></div>
      </div>
      <NumberInput label="Store price" hideControls prefix={`${APP_CURRENCY_SYMBOL} `} min={0} decimalScale={2} value={price} onChange={setPrice} disabled={!canUpdatePrice} />
      <Switch label="Available" checked={available} onChange={(event) => setAvailable(event.currentTarget.checked)} color="basil" disabled={!canUpdateAvailability} />
      <div className="flex gap-2 md:justify-end">
        {(canUpdatePrice || canUpdateAvailability) && <Button size="xs" variant="light" leftSection={<Save size={14} />} disabled={!changed} loading={updateProduct.isPending} onClick={save}>Save</Button>}
        {canRemove && <Button size="xs" variant="subtle" color="red" aria-label={`Remove ${mapping.product.name}`} loading={removeProduct.isPending} onClick={confirmRemove}><Trash2 size={15} /></Button>}
      </div>
    </div>
  );
}
