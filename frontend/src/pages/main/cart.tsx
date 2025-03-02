import {
  useGetCart,
  useRemoveCartItem,
  useUpdateCartItemQuantity,
} from "../../hooks/cart";
import { Button, Card, Divider, Text, Badge } from "@mantine/core";
import { Trash2, Minus, Plus } from "lucide-react";
import { BASE_URL } from "../../lib/constants";
import { useNavigate } from "react-router";
import { useGetAddresses } from "../../hooks/user";
import { useAuthModalStore } from "../../store/modal";
import AddressForm from "../../components/main/address-form";
import { ItemRes } from "../../lib/types";
import { success } from "../../lib/utils";

const Cart = () => {
  const { data: cart } = useGetCart();
  const { openModal, closeModal } = useAuthModalStore();
  const updateCartM = useUpdateCartItemQuantity();
  const removeCartItemM = useRemoveCartItem();

  const { data: addresses } = useGetAddresses();

  const navigate = useNavigate();

  const onSubmit = () => {
    closeModal();
    navigate("/checkout");
  };

  const handleDelete = (id: number) => {
    const confirm = window.confirm(
      "Are you sure you want to remove this item?"
    );
    if (!confirm) return;
    removeCartItemM.mutate(id, {
      onSuccess: (res) => {
        success(res.message);
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
      });
    }
  };

  // if (isLoading) return <Loader className="m-auto" />;

  return (
    <>
      <div className="max-w-5xl mx-auto p-4 flex flex-col md:flex-row gap-6 min-h-screen">
        {/* Cart Items Section */}
        <div className="w-full md:w-2/3">
          <h2 className="text-2xl font-semibold mb-4">Your Cart</h2>

          {cart.items.length ? (
            <div className="flex flex-col gap-4">
              {cart.items.map((item) => (
                <Card key={item.id} shadow="sm" padding="lg" className="border">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <img
                      className="w-24 h-24 rounded-md object-cover border"
                      src={`${BASE_URL}${item.product.image}`}
                      alt={item.product.name}
                    />

                    {/* Product Details */}
                    <div className="flex-1">
                      <Text className="text-lg font-semibold">
                        {item.product.name}
                      </Text>
                      <Text className="text-gray-500">₹{item.price}</Text>

                      {/* Show Customizations if available */}
                      {item.customizations.length > 0 && (
                        <div className="mt-2 flex gap-2 flex-wrap">
                          {item.customizations.map((custom) => (
                            <Badge key={custom.optionId} variant="filled">
                              {custom.name} (₹{custom.price})
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quantity and Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => handleQuantity(item, "-")}
                      >
                        <Minus size={16} />
                      </Button>
                      <Text className="w-6 text-center">{item.quantity}</Text>
                      <Button
                        onClick={() => handleQuantity(item, "+")}
                        size="xs"
                        variant="light"
                      >
                        <Plus size={16} />
                      </Button>
                      <Button
                        onClick={() => handleDelete(item.id)}
                        size="xs"
                        variant="light"
                        color="red"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Text className="text-center text-gray-500">
              Your cart is empty.
            </Text>
          )}
        </div>

        {/* Checkout Section */}
        {cart.items.length > 0 && (
          <div className="w-full md:w-1/3">
            <Card shadow="lg" padding="lg" className="border sticky top-16">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <Divider className="mb-4" />

              <div className="flex justify-between items-center">
                <Text className="text-lg font-semibold">Total:</Text>
                <Text className="text-lg font-semibold">
                  ₹{cart!.totalPrice}
                </Text>
              </div>

              <Button
                onClick={handleClick}
                fullWidth
                size="lg"
                color="red"
                className="mt-4"
              >
                Checkout
              </Button>
            </Card>
          </div>
        )}
      </div>
    </>
  );
};

export default Cart;
