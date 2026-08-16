import { useState } from "react";
import { Badge, Button, Drawer } from "@mantine/core";
import { Leaf, ShoppingCart } from "lucide-react";
import { BASE_URL, Product, success } from "@/lib";
import { CART_API_HOOKS } from "@/hooks";
import { useAuthModalStore, useUser } from "@/store";
import Login from "@/components/auth/login";
import Customize from "../customize";

const ProductCard = ({ product }: { product: Product }) => {
  const addToCartM = CART_API_HOOKS.useAddToCart();
  const [opened, setOpened] = useState(false);
  const { isLoggedIn } = useUser();
  const { openModal } = useAuthModalStore();

  const close = () => setOpened(false);

  const handleAddToCart = () => {
    if (!isLoggedIn) {
      openModal({
        content: <Login />,
        title: "Sign in to order",
      });
      return;
    }

    if (product.hasCustomization) {
      setOpened(true);
    } else {
      addToCartM.mutate(
        {
          productId: product.id,
          cIds: [],
        },
        {
          onSuccess: (res) => {
            success(res.message);
          },
        }
      );
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition p-4 flex flex-col">
        {/* Product Image */}
        <div className="relative">
          <img
            src={`${BASE_URL}${product.image}`}
            alt={product.name}
            className="w-full h-40 object-cover rounded-lg"
          />

          {/* Veg/Non-Veg Badge */}
          {product.veg !== null && (
            <Badge
              color={product.veg ? "basil" : "red"}
              className="absolute top-2 left-2 text-xs px-2 py-1 rounded-lg bg-opacity-90 font-medium"
            >
              <Leaf size={14} className="inline-block mr-1" />
              {product.veg ? "Veg" : "Non-Veg"}
            </Badge>
          )}
        </div>

        {/* Product Info */}
        <div className="mt-3 flex-1">
          <h3 className="text-lg font-semibold text-ink font-sans">
            {product.name}
          </h3>

          {/* Description */}
          {product.description && (
            <p className="text-ink-muted text-sm mt-1 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        {/* Price and Add to Cart */}
        <div className="mt-auto flex justify-between items-center pt-2">
          <span className="text-brand font-bold text-lg">
            ₹{product.price}
          </span>

          {isLoggedIn && (
            <>
              {product.isAvailable ? (
                <Button
                  variant="filled"
                  color="brand"
                  size="xs"
                  onClick={handleAddToCart}
                  leftSection={<ShoppingCart size={16} />}
                >
                  Add to Cart
                </Button>
              ) : (
                <span className="text-ink-muted text-sm">Not Available</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Customization Drawer */}
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title="Customize Your Order"
        position="right"
      >
        <Customize id={product.id} price={product.price} close={close} />
      </Drawer>
    </>
  );
};

export default ProductCard;
