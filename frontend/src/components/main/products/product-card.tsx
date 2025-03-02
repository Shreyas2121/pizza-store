import { useState } from "react";
import { Product } from "../../../lib/types";
import { Badge, Button, Drawer } from "@mantine/core";
import { Leaf, ShoppingCart } from "lucide-react";
import { BASE_URL } from "../../../lib/constants";
import { useAddToCart } from "../../../hooks/cart";
import { success } from "../../../lib/utils";

import { useUser } from "../../../store/user";
import Customize from "../customize";

const ProductCard = ({ product }: { product: Product }) => {
  const addToCartM = useAddToCart();
  const [opened, setOpened] = useState(false);
  const { isLoggedIn } = useUser();

  const close = () => setOpened(false);

  const handleAddToCart = () => {
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
              color={product.veg ? "green" : "red"}
              className="absolute top-2 left-2 text-xs px-2 py-1 rounded-lg bg-opacity-90"
            >
              <Leaf size={14} className="inline-block mr-1" />
              {product.veg ? "Veg" : "Non-Veg"}
            </Badge>
          )}
        </div>

        {/* Product Info */}
        <div className="mt-3 flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {product.name}
          </h3>

          {/* Description */}
          {product.description && (
            <p className="text-gray-600 text-sm mt-1 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        {/* Price and Add to Cart */}
        <div className="mt-auto flex justify-between items-center">
          <span className="text-orange-500 font-bold text-lg">
            ₹{product.price}
          </span>

          {isLoggedIn && (
            <Button
              variant="filled"
              color="orange"
              size="xs"
              onClick={handleAddToCart}
              leftSection={<ShoppingCart size={16} />}
            >
              Add to Cart
            </Button>
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
