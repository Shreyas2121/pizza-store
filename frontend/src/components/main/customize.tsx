import { Button, Checkbox, Radio, Skeleton } from "@mantine/core";
import { AlertCircle, RotateCcw, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CART_API_HOOKS, PRODUCTS_HOOKS } from "@/hooks";
import { formatPrice, Group, ItemRes, Product, success } from "@/lib";

type Selection = Record<number, number | number[]>;

const Customize = ({ product, close, cartItem }: { product: Product; close: () => void; cartItem?: ItemRes }) => {
  const { data, isLoading, isError, refetch } = PRODUCTS_HOOKS.useGetProductCustomization(product.id);
  const addToCartM = CART_API_HOOKS.useAddToCart();
  const updateCustomizationsM = CART_API_HOOKS.useUpdateCartItemCustomizations();
  const [selection, setSelection] = useState<Selection>({});

  const groups = useMemo(() => (data ?? []).map((entry) => entry.group), [data]);

  useEffect(() => {
    if (!cartItem || groups.length === 0) return;
    const existingIds = cartItem.customizations.map((customization) => customization.optionId);
    const initial: Selection = {};
    groups.forEach((group) => {
      const matches = group.options.filter((option) => existingIds.includes(option.id)).map((option) => option.id);
      if (group.type === "multiple") initial[group.id] = matches;
      else if (matches[0]) initial[group.id] = matches[0];
    });
    setSelection(initial);
  }, [cartItem, groups]);

  const selectedIds = useMemo(
    () => Object.values(selection).flatMap((value) => Array.isArray(value) ? value : [value]),
    [selection]
  );

  const extrasTotal = useMemo(
    () => groups.flatMap((group) => group.options).filter((option) => selectedIds.includes(option.id)).reduce((sum, option) => sum + (option.price ?? 0), 0),
    [groups, selectedIds]
  );

  const incompleteGroups = groups.filter((group) => {
    if (!group.required) return false;
    const selected = selection[group.id];
    return group.type === "multiple" ? !Array.isArray(selected) || selected.length === 0 : typeof selected !== "number";
  });

  const setSingle = (group: Group, value: string) => {
    setSelection((current) => {
      const next = { ...current };
      if (value === "none") delete next[group.id];
      else next[group.id] = Number(value);
      return next;
    });
  };

  const setMultiple = (group: Group, values: string[]) => {
    setSelection((current) => ({ ...current, [group.id]: values.map(Number) }));
  };

  const handleSubmit = () => {
    if (incompleteGroups.length > 0 || addToCartM.isPending || updateCustomizationsM.isPending) return;
    const mutation = cartItem ? updateCustomizationsM : addToCartM;
    const payload = cartItem ? { cartItemId: cartItem.id, cIds: selectedIds } : { productId: product.id, cIds: selectedIds };
    mutation.mutate(
      payload as never,
      {
        onSuccess: (response: { message: string }) => {
          success(response.message);
          close();
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-5 p-5" aria-label="Loading customization options">
        <Skeleton height={72} radius="lg" />
        {[...Array(3)].map((_, index) => <Skeleton key={index} height={150} radius="lg" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-5">
        <div className="empty-state m-0 w-full">
          <AlertCircle size={36} className="text-brand" aria-hidden="true" />
          <h3 className="mt-3 text-card-title-scale">Options couldn’t be loaded</h3>
          <p className="mt-2 text-supporting-scale">Try again before adding this pizza.</p>
          <button type="button" className="secondary-button mt-5 gap-2" onClick={() => refetch()}><RotateCcw size={17} /> Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="rounded-card border border-border bg-surface p-4 shadow-subtle">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Build your order</p>
          <h3 className="mt-1 text-xl font-bold text-ink">{product.name}</h3>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-ink-muted">Base price</span>
            <span className="font-semibold tabular-nums text-ink">{formatPrice(product.price)}</span>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="mt-5 rounded-card border border-dashed border-border bg-surface p-6 text-center">
            <p className="font-semibold text-ink">No extras needed</p>
            <p className="mt-1 text-sm text-ink-muted">This pizza is ready to add as shown.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {groups.map((group) => {
              const availableOptions = group.options.filter((option) => option.isAvailable);
              const status = group.required ? "Required" : "Optional";

              return (
                <fieldset key={group.id} className="rounded-card border border-border bg-surface p-4 shadow-subtle">
                  <legend className="w-full px-0">
                    <span className="flex w-full items-start justify-between gap-3">
                      <span>
                        <span className="block font-semibold text-ink">{group.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-muted">{group.type === "single" ? "Choose one" : "Choose any that you like"}</span>
                      </span>
                      <span className={`rounded-pill px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${group.required ? "bg-brand-soft text-brand" : "bg-surface-muted text-ink-muted"}`}>{status}</span>
                    </span>
                  </legend>

                  {availableOptions.length === 0 ? (
                    <p className="mt-4 rounded-control bg-surface-muted p-3 text-sm text-ink-muted">No choices are currently available.</p>
                  ) : group.type === "single" ? (
                    <Radio.Group value={typeof selection[group.id] === "number" ? String(selection[group.id]) : "none"} onChange={(value) => setSingle(group, value)} name={`customization-${group.id}`}>
                      <div className="mt-4 space-y-2">
                        {!group.required && <Radio value="none" label="No thanks" className="rounded-control px-2 py-2 hover:bg-surface-muted" />}
                        {group.options.map((option) => (
                          <Radio
                            key={option.id}
                            value={String(option.id)}
                            disabled={!option.isAvailable}
                            className="rounded-control px-2 py-2 hover:bg-surface-muted"
                            label={<span className="flex w-full items-center justify-between gap-4"><span>{option.name}{!option.isAvailable && <span className="ml-2 text-xs text-ink-muted">Unavailable</span>}</span><span className="whitespace-nowrap text-sm font-medium tabular-nums text-ink-muted">{option.price ? `+${formatPrice(option.price)}` : "Included"}</span></span>}
                          />
                        ))}
                      </div>
                    </Radio.Group>
                  ) : (
                    <Checkbox.Group value={Array.isArray(selection[group.id]) ? selection[group.id].map(String) : []} onChange={(values) => setMultiple(group, values)}>
                      <div className="mt-4 space-y-2">
                        {group.options.map((option) => (
                          <Checkbox
                            key={option.id}
                            value={String(option.id)}
                            disabled={!option.isAvailable}
                            className="rounded-control px-2 py-2 hover:bg-surface-muted"
                            label={<span className="flex w-full items-center justify-between gap-4"><span>{option.name}{!option.isAvailable && <span className="ml-2 text-xs text-ink-muted">Unavailable</span>}</span><span className="whitespace-nowrap text-sm font-medium tabular-nums text-ink-muted">{option.price ? `+${formatPrice(option.price)}` : "Included"}</span></span>}
                          />
                        ))}
                      </div>
                    </Checkbox.Group>
                  )}
                </fieldset>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-surface px-5 py-4 shadow-[0_-8px_24px_rgba(32,26,23,0.06)] pb-[max(1rem,env(safe-area-inset-bottom))]">
        {incompleteGroups.length > 0 && (
          <p className="mb-3 flex items-start gap-2 text-xs font-medium text-brand" role="status"><AlertCircle size={15} className="mt-px shrink-0" aria-hidden="true" />Choose an option in {incompleteGroups.map((group) => group.name).join(", ")}.</p>
        )}
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-xs text-ink-muted">Total</p><p className="text-xl font-bold tabular-nums text-ink">{formatPrice(product.price + extrasTotal)}</p></div>
          <Button size="md" loading={addToCartM.isPending || updateCustomizationsM.isPending} disabled={incompleteGroups.length > 0} onClick={handleSubmit} leftSection={<ShoppingCart size={18} />}>
            {cartItem ? "Update item" : "Add to cart"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Customize;
