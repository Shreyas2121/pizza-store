import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock3, MapPin, ShoppingCart, Store as StoreIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { AddressForm, useGetAddresses } from "@/features/account";
import { CustomizationDrawer } from "@/features/catalog";
import { useCheckoutQuote, type CheckoutQuoteRequest } from "@/features/checkout";
import { EmptyState, PageHeader } from "@/shared/ui";

import { useAuthModalStore } from "@/shared/model";
import { error, formatStoreHours, handleStockApiError, success } from "@/shared/lib";
import { useStoreStore } from "@/features/store";
import { ItemRes } from "../model/cart.types";
import {
  cartKeys,
  useGetCart,
  useRemoveCartItem,
  useUpdateCartItemQuantity,
} from "../api/cart.queries";
import CartItemCard from "../components/cart-item";
import CartSummary from "../components/cart-summary";

export const CartPage = () => {
  const { data: rawCart } = useGetCart();
  const cart = rawCart || { id: 0, userId: 0, items: [], totalPaise: 0, storeId: null, store: null };
  const queryClient = useQueryClient();
  const { openModal, closeModal } = useAuthModalStore();
  const updateCartM = useUpdateCartItemQuantity();
  const removeCartItemM = useRemoveCartItem();
  const { data: addresses, isLoading: addressesLoading } = useGetAddresses();
  const [editingItem, setEditingItem] = useState<ItemRes | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<Set<number>>(new Set());
  const removalTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const navigate = useNavigate();
  const resolvedStore = useStoreStore((state) => state.resolvedStore);
  const isStoreResolved = useStoreStore((state) => state.isStoreResolved);
  const openPincodeModal = useStoreStore((state) => state.openPincodeModal);

  useEffect(() => () => {
    removalTimers.current.forEach((timer, itemId) => {
      clearTimeout(timer);
      notifications.hide(`remove-cart-${itemId}`);
    });
  }, []);

  const visibleItems = useMemo(
    () => cart.items.filter((item) => !pendingRemoval.has(item.id)),
    [cart.items, pendingRemoval]
  );
  const itemCount = visibleItems.reduce((total, item) => total + item.quantity, 0);
  const storeMatchesCart = itemCount === 0 || (!!resolvedStore && cart.storeId === resolvedStore.id);
  const quoteRequest = useMemo((): CheckoutQuoteRequest | null => {
    if (!cart.storeId || visibleItems.length === 0) return null;
    return {
      storeId: cart.storeId,
      items: visibleItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        customizationOptionIds: item.customizations.map((option) => option.optionId),
      })),
    };
  }, [cart.storeId, visibleItems]);
  const cartQuote = useCheckoutQuote(quoteRequest, { enabled: quoteRequest !== null });

  const finishAddress = () => {
    closeModal();
    navigate("/checkout");
  };

  const checkout = () => {
    if (addressesLoading || cartQuote.isPending || cartQuote.isError || !cartQuote.data || itemCount === 0) return;
    if (!isStoreResolved || !resolvedStore) { openPincodeModal(); return; }
    if (!storeMatchesCart) { error("Choose the delivery area for the store attached to your cart, or clear the cart by changing areas."); openPincodeModal(); return; }
    if (addresses?.length) navigate("/checkout");
    else
      openModal({
        content: <AddressForm onSubmit={finishAddress} />,
        title: "",
        options: { size: 560, padding: "lg", radius: "lg" },
      });
  };

  const undoRemoval = (itemId: number, notificationId: string) => {
    const timer = removalTimers.current.get(itemId);
    if (timer) clearTimeout(timer);
    removalTimers.current.delete(itemId);
    setPendingRemoval((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
    notifications.hide(notificationId);
  };

  const removeWithUndo = (item: ItemRes) => {
    if (pendingRemoval.has(item.id)) return;
    setPendingRemoval((current) => new Set(current).add(item.id));
    const notificationId = `remove-cart-${item.id}`;
    notifications.show({
      id: notificationId,
      title: "Item removed",
      message: (
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <span className="text-xs sm:text-sm text-ink-muted leading-snug">
            {item.product.name} was removed from your cart.
          </span>
          <button
            type="button"
            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-brand hover:text-brand-hover bg-brand-soft hover:bg-brand-100 rounded-full transition-colors shrink-0 cursor-pointer"
            onClick={() => undoRemoval(item.id, notificationId)}
          >
            Undo
          </button>
        </div>
      ),
      color: "brand",
      autoClose: 5000,
      withCloseButton: false,
    });
    removalTimers.current.set(
      item.id,
      setTimeout(() => {
        removalTimers.current.delete(item.id);
        removeCartItemM.mutate(item.id, {
          onError: () =>
            setPendingRemoval((current) => {
              const next = new Set(current);
              next.delete(item.id);
              return next;
            }),
        });
      }, 5000)
    );
  };

  const changeQuantity = (item: ItemRes, type: "+" | "-") => {
    if (item.quantity === 1 && type === "-") {
      removeWithUndo(item);
      return;
    }
    updateCartM.mutate(
      { productId: item.productId, cartItemId: item.id, type },
      {
        onSuccess: (response) => success(response.message),
        onError: (cause) => {
          handleStockApiError(cause, "Failed to update item quantity.");
          queryClient.invalidateQueries({ queryKey: cartKeys.all });
          queryClient.invalidateQueries({ queryKey: ["catalog"] });
        },
      }
    );
  };

  return (
    <div className={`page-shell ${itemCount > 0 ? "pb-28 lg:pb-10" : ""}`}>
      <PageHeader
        eyebrow="Shopping cart"
        title="Your cart"
        description={`${itemCount} ${itemCount === 1 ? "item" : "items"} ready for review.`}
      />

      {itemCount > 0 && cart.store && (
        <div className={`mb-5 flex flex-col gap-3 rounded-card border p-4 sm:flex-row sm:items-center sm:justify-between ${storeMatchesCart ? "border-basil/30 bg-basil-soft" : "border-amber-300 bg-amber-50"}`}>
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-brand"><StoreIcon size={19} /></span><div><p className="font-semibold text-ink">Ordering from {cart.store.name}</p><p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted"><span className="inline-flex items-center gap-1"><MapPin size={14} />{cart.store.city}</span><span className="inline-flex items-center gap-1"><Clock3 size={14} />{formatStoreHours(cart.store.opensAt, cart.store.closesAt)} IST</span></p></div></div>
          {!storeMatchesCart && <Button variant="light" color="yellow" onClick={openPincodeModal}>Review delivery area</Button>}
        </div>
      )}

      {!isStoreResolved && itemCount > 0 && (
        <div className="mb-5 rounded-card border border-brand/25 bg-brand-soft p-4 text-sm text-ink"><p className="font-semibold">Select a delivery pincode before checkout.</p><button type="button" onClick={openPincodeModal} className="mt-2 font-bold text-brand underline underline-offset-4">Enter pincode</button></div>
      )}

      {itemCount > 0 ? (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <CartItemCard
                key={item.id}
                item={item}
                updatingQuantity={updateCartM.isPending}
                onQuantityChange={(type) => changeQuantity(item, type)}
                onEditOptions={() => setEditingItem(item)}
                onRemove={() => removeWithUndo(item)}
              />
            ))}
          </div>

          <CartSummary
            subtotalPaise={cartQuote.data?.itemsSubtotalPaise ?? null}
            itemCount={itemCount}
            loading={addressesLoading || cartQuote.isPending}
            error={cartQuote.isError ? "The server could not price this cart. Refresh or update the cart and try again." : null}
            disabled={!isStoreResolved || !storeMatchesCart || !cartQuote.data}
            onCheckout={checkout}
          />
        </div>
      ) : (
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is waiting"
          description="Explore our handcrafted pizzas and build a meal worth looking forward to."
          action={
            <Button
              onClick={() => navigate("/#menu")}
              rightSection={<ArrowRight size={18} />}
            >
              Browse the menu
            </Button>
          }
        />
      )}

      <Drawer
        opened={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Edit customizations"
        position="right"
        size="100%"
        padding={0}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        classNames={{
          content: "md:max-w-[480px]",
          header: "border-b border-border px-5 py-4",
          body: "h-[calc(100dvh-73px)] overflow-hidden",
        }}
      >
        {editingItem && (
          <CustomizationDrawer
            product={editingItem.product}
            cartItem={editingItem}
            close={() => setEditingItem(null)}
          />
        )}
      </Drawer>
    </div>
  );
};

export default CartPage;
