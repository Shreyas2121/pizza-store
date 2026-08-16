import { AddressForm } from "@/components/main";
import { EmptyState, PageHeader } from "@/components/common";
import { CART_API_HOOKS, USER_API_HOOKS } from "@/hooks";
import { BASE_URL, formatPrice, ItemRes, success } from "@/lib";
import { useAuthModalStore } from "@/store";
import { Button, Card, Divider, Text, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { Minus, Plus, ShoppingCart, Trash2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";

const Cart = () => {
  const { data: rawCart } = CART_API_HOOKS.useGetCart();
  const cart = rawCart || { id: 0, userId: 0, items: [], totalPrice: 0 };
  const { openModal, closeModal } = useAuthModalStore();
  const updateCartM = CART_API_HOOKS.useUpdateCartItemQuantity();
  const removeCartItemM = CART_API_HOOKS.useRemoveCartItem();

  const { data: addresses } = USER_API_HOOKS.useGetAddresses();

  const navigate = useNavigate();

  const onSubmit = () => {
    closeModal();
    navigate("/checkout");
  };

  const handleDelete = (id: number) => {
    modals.openConfirmModal({
      title: "Remove item from cart?",
      children: (
        <Text size="sm" c="dimmed">
          Are you sure you want to remove this item from your cart?
        </Text>
      ),
      labels: { confirm: "Remove Item", cancel: "Keep Item" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        removeCartItemM.mutate(id, {
          onSuccess: (res) => {
            success(res.message);
          },
        });
      },
    });
  };

  const handleQuantity = (item: ItemRes, type: "+" | "-") => {
    if (item.quantity === 1 && type === "-") {
      handleDelete(item.id);
      return;
    }

    updateCartM.mutate(
      {
        productId: item.productId,
        cartItemId: item.id,
        type,
      },
      {
        onSuccess: (data) => {
          success(data.message);
        },
      }
    );
  };

  const handleClick = () => {
    if (addresses && addresses.length > 0) {
      navigate("/checkout");
    } else {
      openModal({
        content: <AddressForm onSubmit={onSubmit} />,
        title: "",
        options: { size: 560, padding: "lg", radius: "lg" },
      });
    }
  };

  const hasItems = cart && cart.items && cart.items.length > 0;

  return (
    <div className="max-w-storefront mx-auto px-4 sm:px-6 py-6 sm:py-8 min-h-[calc(100vh-4rem)]">
      <PageHeader
        eyebrow="Shopping Cart"
        title="Your Cart"
        description="Review your artisanal pizza order, adjust options, and proceed to checkout."
      />

      {hasItems ? (
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Cart Items Section */}
          <div className="w-full lg:flex-1 space-y-4">
            {cart.items.map((item) => (
              <Card
                key={item.id}
                shadow="subtle"
                padding="md"
                className="border border-border bg-surface rounded-card hover:border-border/80 transition-colors"
              >
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  {/* Item Row 1: Image & Details */}
                  <div className="flex gap-4 flex-1 items-start sm:items-center">
                    <img
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-control object-cover border border-border shrink-0"
                      src={`${BASE_URL}${item.product.image}`}
                      alt={item.product.name}
                    />

                    <div className="flex-1 space-y-1">
                      <h3 className="text-base sm:text-lg font-semibold text-ink font-sans leading-snug">
                        {item.product.name}
                      </h3>
                      <p className="text-sm font-bold text-brand">
                        {formatPrice(item.price)}
                      </p>

                      {/* Quiet Customization Chips */}
                      {item.customizations.length > 0 && (
                        <div className="pt-1 flex gap-1.5 flex-wrap">
                          {item.customizations.map((custom) => (
                            <span
                              key={custom.optionId}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-surface-muted text-ink-muted border border-border/80"
                            >
                              {custom.name} (+{formatPrice(custom.price)})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Item Row 2 (or right column on desktop): Unified Stepper & Low-emphasis Remove */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/60">
                    {/* Unified Quantity Stepper */}
                    <div className="inline-flex items-center border border-border rounded-control bg-surface-muted p-0.5">
                      <Tooltip label="Decrease quantity">
                        <button
                          type="button"
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-control hover:bg-surface text-ink-muted hover:text-ink transition-colors disabled:opacity-40"
                          aria-label={`Decrease quantity of ${item.product.name}`}
                          onClick={() => handleQuantity(item, "-")}
                        >
                          <Minus size={16} />
                        </button>
                      </Tooltip>
                      <span className="px-3 text-sm font-semibold text-ink min-w-[36px] text-center">
                        {item.quantity}
                      </span>
                      <Tooltip label="Increase quantity">
                        <button
                          type="button"
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-control hover:bg-surface text-ink-muted hover:text-ink transition-colors"
                          aria-label={`Increase quantity of ${item.product.name}`}
                          onClick={() => handleQuantity(item, "+")}
                        >
                          <Plus size={16} />
                        </button>
                      </Tooltip>
                    </div>

                    {/* Low-emphasis Remove Action */}
                    <Tooltip label="Remove item">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-danger px-2.5 py-2 rounded-control hover:bg-red-50 transition-colors"
                        aria-label={`Remove ${item.product.name} from cart`}
                      >
                        <Trash2 size={16} />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Sticky Order Summary Section */}
          <div className="w-full lg:w-96 shrink-0 lg:sticky lg:top-24">
            <Card
              shadow="subtle"
              padding="lg"
              className="border border-border bg-surface rounded-card space-y-4"
            >
              <h2 className="text-lg font-bold text-ink font-sans">
                Order Summary
              </h2>
              <Divider className="border-border" />

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <span>Subtotal</span>
                  <span className="font-medium text-ink">
                    {formatPrice(cart.totalPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-basil">FREE</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Discount</span>
                  <span className="font-medium text-ink">₹0.00</span>
                </div>
              </div>

              <Divider className="border-border" />

              <div className="flex justify-between items-baseline pt-1">
                <span className="text-base font-bold text-ink">Total</span>
                <span className="text-xl font-bold text-brand">
                  {formatPrice(cart.totalPrice)}
                </span>
              </div>

              <Button
                onClick={handleClick}
                fullWidth
                size="md"
                color="brand"
                rightSection={<ArrowRight size={18} />}
                className="mt-4 shadow-subtle hover:shadow-subtle-hover transition-all"
              >
                Proceed to Checkout
              </Button>
            </Card>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is waiting"
          description="Explore our handcrafted wood-fired pizzas, fresh sides, and refreshing beverages to build your meal."
          action={
            <Button
              color="brand"
              size="md"
              onClick={() => navigate("/")}
              rightSection={<ArrowRight size={18} />}
            >
              Browse the Menu
            </Button>
          }
        />
      )}
    </div>
  );
};

export default Cart;
