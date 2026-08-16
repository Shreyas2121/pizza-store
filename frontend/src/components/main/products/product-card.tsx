import { useState } from "react";
import { Button, Drawer } from "@mantine/core";
import { ImageOff, Settings2, ShoppingCart } from "lucide-react";
import { Product } from "@/lib";
import { BASE_URL } from "@/shared/config";
import { formatPrice, success } from "@/shared/lib";
import { CART_API_HOOKS } from "@/hooks";
import { useAuthModalStore } from "@/shared/model";
import { Login, useUser } from "@/features/auth";
import Customize from "../customize";

const DietaryMark = ({ vegetarian }: { vegetarian: boolean }) => {
  const color = vegetarian ? "#39734E" : "#8B2E1F";
  const label = vegetarian ? "Vegetarian" : "Non-vegetarian";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface/95 px-2 py-1 text-xs font-semibold text-ink shadow-subtle" aria-label={label}>
      <span className="grid h-4 w-4 place-items-center border-2" style={{ borderColor: color }} aria-hidden="true">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      </span>
      {vegetarian ? "Veg" : "Non-veg"}
    </span>
  );
};

const ProductCard = ({ product }: { product: Product }) => {
  const addToCartM = CART_API_HOOKS.useAddToCart();
  const [opened, setOpened] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { isLoggedIn } = useUser();
  const { openModal } = useAuthModalStore();

  const handleAddToCart = () => {
    if (!product.isAvailable || addToCartM.isPending) return;

    if (!isLoggedIn) {
      openModal({ content: <Login />, title: "", options: { size: 440, padding: "lg", radius: "lg" } });
      return;
    }

    if (product.hasCustomization) {
      setOpened(true);
      return;
    }

    addToCartM.mutate(
      { productId: product.id, cIds: [] },
      { onSuccess: (response) => success(response.message) }
    );
  };

  const buttonLabel = !product.isAvailable
    ? "Sold out"
    : !isLoggedIn
      ? "Sign in to add"
      : product.hasCustomization
        ? "Customize"
        : "Add to cart";

  return (
    <>
      <article className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-subtle transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-subtle-hover focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
          {!imageFailed ? (
            <img
              src={`${BASE_URL}${product.image}`}
              alt={product.name}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035] ${!product.isAvailable ? "grayscale-[35%]" : ""}`}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted" role="img" aria-label={`${product.name} image unavailable`}>
              <ImageOff size={30} aria-hidden="true" />
              <span className="text-xs font-medium">Image unavailable</span>
            </div>
          )}

          {product.veg !== null && <span className="absolute left-3 top-3"><DietaryMark vegetarian={product.veg} /></span>}
          {!product.isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/45">
              <span className="rounded-pill bg-surface px-4 py-2 text-sm font-bold text-ink shadow-panel">Sold out</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="flex-1">
            <h3 className="text-card-title-scale line-clamp-2">{product.name}</h3>
            {product.description ? (
              <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-ink-muted">{product.description}</p>
            ) : (
              <p className="mt-2 min-h-10 text-sm leading-5 text-ink-muted">Freshly prepared with our signature crust and sauce.</p>
            )}
            {product.hasCustomization && product.isAvailable && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-basil"><Settings2 size={14} aria-hidden="true" /> Sizes and extras available</p>
            )}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-medium text-ink-muted">From</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">{formatPrice(product.price)}</p>
            <Button
              fullWidth
              mt="md"
              size="md"
              disabled={!product.isAvailable}
              loading={addToCartM.isPending}
              loaderProps={{ type: "dots" }}
              onClick={handleAddToCart}
              leftSection={product.hasCustomization && isLoggedIn ? <Settings2 size={17} /> : <ShoppingCart size={17} />}
            >
              {buttonLabel}
            </Button>
          </div>
        </div>
      </article>

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title="Customize your pizza"
        position="right"
        size="100%"
        padding={0}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        classNames={{ content: "md:max-w-[480px]", header: "border-b border-border px-5 py-4", body: "h-[calc(100dvh-73px)] overflow-hidden" }}
      >
        <Customize product={product} close={() => setOpened(false)} />
      </Drawer>
    </>
  );
};

export default ProductCard;
