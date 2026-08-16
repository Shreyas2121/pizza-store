import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Drawer, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ArrowRight, Minus, Plus, Settings2, ShoppingCart, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { AddressForm, Customize } from "@/components/main";
import { EmptyState, PageHeader } from "@/components/common";
import { CART_API_HOOKS, USER_API_HOOKS } from "@/hooks";
import { BASE_URL, formatPrice, ItemRes, success } from "@/lib";
import { useAuthModalStore } from "@/store";

const Cart = () => {
  const { data: rawCart } = CART_API_HOOKS.useGetCart();
  const cart = rawCart || { id: 0, userId: 0, items: [], totalPrice: 0 };
  const { openModal, closeModal } = useAuthModalStore();
  const updateCartM = CART_API_HOOKS.useUpdateCartItemQuantity();
  const removeCartItemM = CART_API_HOOKS.useRemoveCartItem();
  const { data: addresses, isLoading: addressesLoading } = USER_API_HOOKS.useGetAddresses();
  const [editingItem, setEditingItem] = useState<ItemRes | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<Set<number>>(new Set());
  const removalTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const navigate = useNavigate();

  useEffect(() => () => {
    removalTimers.current.forEach((timer, itemId) => {
      clearTimeout(timer);
      notifications.hide(`remove-cart-${itemId}`);
    });
  }, []);

  const visibleItems = cart.items.filter((item) => !pendingRemoval.has(item.id));
  const itemCount = visibleItems.reduce((total, item) => total + item.quantity, 0);
  const subtotal = useMemo(() => {
    const hiddenTotal = cart.items.filter((item) => pendingRemoval.has(item.id)).reduce((total, item) => total + (item.price + item.customizations.reduce((sum, option) => sum + option.price, 0)) * item.quantity, 0);
    return Math.max(0, cart.totalPrice - hiddenTotal);
  }, [cart.items, cart.totalPrice, pendingRemoval]);

  const finishAddress = () => { closeModal(); navigate("/checkout"); };
  const checkout = () => {
    if (addressesLoading || itemCount === 0) return;
    if (addresses?.length) navigate("/checkout");
    else openModal({ content: <AddressForm onSubmit={finishAddress} />, title: "", options: { size: 560, padding: "lg", radius: "lg" } });
  };

  const undoRemoval = (itemId: number, notificationId: string) => {
    const timer = removalTimers.current.get(itemId);
    if (timer) clearTimeout(timer);
    removalTimers.current.delete(itemId);
    setPendingRemoval((current) => { const next = new Set(current); next.delete(itemId); return next; });
    notifications.hide(notificationId);
  };

  const removeWithUndo = (item: ItemRes) => {
    if (pendingRemoval.has(item.id)) return;
    setPendingRemoval((current) => new Set(current).add(item.id));
    const notificationId = `remove-cart-${item.id}`;
    notifications.show({
      id: notificationId,
      title: "Item removed",
      message: <div className="flex items-center justify-between gap-4"><span>{item.product.name} was removed from your cart.</span><button type="button" className="min-h-9 font-bold text-brand" onClick={() => undoRemoval(item.id, notificationId)}>Undo</button></div>,
      color: "brand",
      autoClose: 5000,
      withCloseButton: false,
    });
    removalTimers.current.set(item.id, setTimeout(() => {
      removalTimers.current.delete(item.id);
      removeCartItemM.mutate(item.id, { onError: () => setPendingRemoval((current) => { const next = new Set(current); next.delete(item.id); return next; }) });
    }, 5000));
  };

  const changeQuantity = (item: ItemRes, type: "+" | "-") => {
    if (item.quantity === 1 && type === "-") { removeWithUndo(item); return; }
    updateCartM.mutate({ productId: item.productId, cartItemId: item.id, type }, { onSuccess: (response) => success(response.message) });
  };

  return (
    <div className={`page-shell ${itemCount > 0 ? "pb-28 lg:pb-10" : ""}`}>
      <PageHeader eyebrow="Shopping cart" title="Your cart" description={`${itemCount} ${itemCount === 1 ? "item" : "items"} ready for review.`} />

      {itemCount > 0 ? (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <article key={item.id} className="rounded-card border border-border bg-surface p-4 shadow-subtle sm:p-5">
                <div className="flex gap-4">
                  <img className="h-20 w-20 shrink-0 rounded-control bg-surface-muted object-cover sm:h-24 sm:w-24" src={`${BASE_URL}${item.product.image}`} alt={item.product.name} />
                  <div className="min-w-0 flex-1"><h2 className="text-card-title-scale">{item.product.name}</h2><p className="mt-1 font-bold tabular-nums text-brand">{formatPrice(item.price)}</p>{item.customizations.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Selected customizations">{item.customizations.map((customization) => <li key={customization.optionId} className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs text-ink-muted">{customization.name}{customization.price > 0 ? ` +${formatPrice(customization.price)}` : ""}</li>)}</ul>}</div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="inline-flex items-center overflow-hidden rounded-control border border-border bg-surface" aria-label={`Quantity for ${item.product.name}`}>
                    <Tooltip label="Decrease quantity"><button type="button" className="grid h-11 w-11 place-items-center text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-40" disabled={updateCartM.isPending} onClick={() => changeQuantity(item, "-")} aria-label={`Decrease ${item.product.name} quantity`}><Minus size={16} /></button></Tooltip>
                    <span className="grid h-11 min-w-11 place-items-center border-x border-border text-sm font-bold tabular-nums text-ink" aria-live="polite">{item.quantity}</span>
                    <Tooltip label="Increase quantity"><button type="button" className="grid h-11 w-11 place-items-center text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-40" disabled={updateCartM.isPending} onClick={() => changeQuantity(item, "+")} aria-label={`Increase ${item.product.name} quantity`}><Plus size={16} /></button></Tooltip>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.product.hasCustomization && <button type="button" onClick={() => setEditingItem(item)} className="tertiary-button min-h-11 gap-1.5 text-sm"><Settings2 size={16} /> Edit options</button>}
                    <button type="button" onClick={() => removeWithUndo(item)} className="tertiary-button min-h-11 gap-1.5 text-sm hover:bg-red-50 hover:text-danger"><Trash2 size={16} /> Remove</button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="sticky top-32 hidden rounded-card border border-border bg-surface p-5 shadow-subtle lg:block" aria-labelledby="cart-summary-title">
            <h2 id="cart-summary-title" className="text-card-title-scale">Order summary</h2>
            <dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="font-medium tabular-nums text-ink">{formatPrice(subtotal)}</dd></div><div className="flex justify-between"><dt className="text-ink-muted">Delivery fee</dt><dd className="tabular-nums text-ink">{formatPrice(0)}</dd></div><div className="flex justify-between"><dt className="text-ink-muted">Discount</dt><dd className="tabular-nums text-ink">{formatPrice(0)}</dd></div><div className="flex justify-between border-t border-border pt-4 text-base font-bold"><dt>Total</dt><dd className="text-xl tabular-nums text-brand">{formatPrice(subtotal)}</dd></div></dl>
            <Button fullWidth size="md" mt="lg" onClick={checkout} loading={addressesLoading} rightSection={<ArrowRight size={18} />}>Continue to checkout</Button>
            <p className="mt-3 text-center text-xs text-ink-muted">You can review delivery and payment before placing the order.</p>
          </aside>
        </div>
      ) : (
        <EmptyState icon={ShoppingCart} title="Your cart is waiting" description="Explore our handcrafted pizzas and build a meal worth looking forward to." action={<Button onClick={() => navigate("/#menu")} rightSection={<ArrowRight size={18} />}>Browse the menu</Button>} />
      )}

      {itemCount > 0 && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(32,26,23,0.1)] backdrop-blur-md lg:hidden"><div className="mx-auto flex max-w-storefront items-center justify-between gap-4"><div><p className="text-xs text-ink-muted">{itemCount} {itemCount === 1 ? "item" : "items"}</p><p className="text-lg font-bold tabular-nums text-ink">{formatPrice(subtotal)}</p></div><Button size="md" onClick={checkout} loading={addressesLoading} rightSection={<ArrowRight size={17} />}>Checkout</Button></div></div>}

      <Drawer opened={!!editingItem} onClose={() => setEditingItem(null)} title="Edit customizations" position="right" size="100%" padding={0} overlayProps={{ backgroundOpacity: 0.4, blur: 2 }} classNames={{ content: "md:max-w-[480px]", header: "border-b border-border px-5 py-4", body: "h-[calc(100dvh-73px)] overflow-hidden" }}>
        {editingItem && <Customize product={editingItem.product} cartItem={editingItem} close={() => setEditingItem(null)} />}
      </Drawer>
    </div>
  );
};

export default Cart;
