import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router";
import { AddressForm, useGetAddresses } from "@/features/account";
import { CustomizationDrawer } from "@/features/catalog";
import { EmptyState, PageHeader } from "@/shared/ui";

import { useAuthModalStore } from "@/shared/model";
import { success } from "@/shared/lib";
import { ItemRes } from "../model/cart.types";
import {
  useGetCart,
  useRemoveCartItem,
  useUpdateCartItemQuantity,
} from "../api/cart.queries";
import CartItemCard from "../components/cart-item";
import CartSummary from "../components/cart-summary";

export const CartPage = () => {
  const { data: rawCart } = useGetCart();
  const cart = rawCart || { id: 0, userId: 0, items: [], totalPrice: 0 };
  const { openModal, closeModal } = useAuthModalStore();
  const updateCartM = useUpdateCartItemQuantity();
  const removeCartItemM = useRemoveCartItem();
  const { data: addresses, isLoading: addressesLoading } = useGetAddresses();
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
    const hiddenTotal = cart.items
      .filter((item) => pendingRemoval.has(item.id))
      .reduce(
        (total, item) =>
          total +
          (item.price +
            item.customizations.reduce((sum, option) => sum + option.price, 0)) *
            item.quantity,
        0
      );
    return Math.max(0, cart.totalPrice - hiddenTotal);
  }, [cart.items, cart.totalPrice, pendingRemoval]);

  const finishAddress = () => {
    closeModal();
    navigate("/checkout");
  };

  const checkout = () => {
    if (addressesLoading || itemCount === 0) return;
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
        <div className="flex items-center justify-between gap-4">
          <span>{item.product.name} was removed from your cart.</span>
          <button
            type="button"
            className="min-h-9 font-bold text-brand"
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
      { onSuccess: (response) => success(response.message) }
    );
  };

  return (
    <div className={`page-shell ${itemCount > 0 ? "pb-28 lg:pb-10" : ""}`}>
      <PageHeader
        eyebrow="Shopping cart"
        title="Your cart"
        description={`${itemCount} ${itemCount === 1 ? "item" : "items"} ready for review.`}
      />

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
            subtotal={subtotal}
            itemCount={itemCount}
            loading={addressesLoading}
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
