import { useMemo, useState } from "react";
import { Button, Checkbox, NumberInput, TextInput } from "@mantine/core";
import { Search } from "lucide-react";
import { APP_CURRENCY_SYMBOL, error, formatPaise, parseRupeesToPaise, success } from "@/shared/lib";
import { useMapStoreProducts } from "../../api/store.queries";
import type { StoreCatalogProduct } from "../../model/store.types";

export function AddStoreProducts({ storeId, products, onSaved }: { storeId: number; products: StoreCatalogProduct[]; onSaved: () => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [prices, setPrices] = useState<Record<number, number | string>>({});
  const mapProducts = useMapStoreProducts(storeId);
  const filtered = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase())), [products, search]);

  const toggle = (product: StoreCatalogProduct) => {
    setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id]);
    setPrices((current) => current[product.id] === undefined ? { ...current, [product.id]: product.pricePaise / 100 } : current);
  };

  const submit = () => {
    const mappings = selected.map((productId) => ({ productId, pricePaise: parseRupeesToPaise(prices[productId]), isAvailable: true }));
    mapProducts.mutate(mappings, {
      onSuccess: () => { success(`${mappings.length} product${mappings.length === 1 ? "" : "s"} added to the store.`); onSaved(); },
      onError: () => error("Products could not be added to the store."),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <TextInput placeholder="Search global catalogue" leftSection={<Search size={16} />} value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
      <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {!filtered.length ? <p className="py-10 text-center text-sm text-ink-muted">No unmapped products found.</p> : filtered.map((product) => {
          const checked = selected.includes(product.id);
          return (
            <div key={product.id} className={`rounded-control border p-3 ${checked ? "border-brand bg-brand-soft" : "border-border"}`}>
              <div className="flex items-center justify-between gap-3">
                <Checkbox label={<span><span className="font-semibold text-ink">{product.name}</span><span className="ml-2 text-xs text-ink-muted">Base {formatPaise(product.pricePaise)}</span></span>} checked={checked} onChange={() => toggle(product)} />
                {checked && <NumberInput aria-label={`Price for ${product.name}`} hideControls prefix={`${APP_CURRENCY_SYMBOL} `} min={0} decimalScale={2} className="w-32" value={prices[product.id] ?? product.pricePaise / 100} onChange={(value) => setPrices((current) => ({ ...current, [product.id]: value }))} />}
              </div>
            </div>
          );
        })}
      </div>
      <Button mt="lg" fullWidth disabled={!selected.length || selected.some((id) => prices[id] === "")} loading={mapProducts.isPending} onClick={submit}>Add {selected.length || "selected"} products</Button>
    </div>
  );
}
