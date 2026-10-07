import { useState } from "react";
import { Button, Drawer } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { ImageOff, Settings2, ShoppingCart } from "lucide-react";
import { Product } from "../../model/catalog.types";
import { catalogKeys } from "../../model/catalog.keys";
import { BASE_URL } from "@/shared/config";
import { formatPaise, handleStockApiError, success, warning } from "@/shared/lib";
import { cartKeys, useAddToCart } from "@/features/cart";
import { useAuthModalStore } from "@/shared/model";
import { Login, useUser } from "@/features/auth";
import CustomizationDrawer from "./customization-drawer";
import { useStoreStore } from "@/features/store";
import { BundleContents, BundlePrice } from "./bundle-merchandising";

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

export const ProductCard = ({ product }: { product: Product }) => {
  const addToCartM = useAddToCart();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { isLoggedIn } = useUser();
  const { openModal } = useAuthModalStore();
  const resolvedStore = useStoreStore((state) => state.resolvedStore);
  const openPincodeModal = useStoreStore((state) => state.openPincodeModal);
  const isBundle = product.productType === "bundle";

  const isOutOfStock = !product.isAvailable || product.stockStatus === "out_of_stock";
  const isLowStock = !isOutOfStock && product.stockStatus === "low_stock" && typeof product.stockCount === "number";

  const handleAddToCart = () => {
    if (isOutOfStock || addToCartM.isPending) return;

    if (!resolvedStore) {
      openPincodeModal();
      return;
    }

    if (!isLoggedIn) {
      openModal({ content: <Login />, title: "", options: { size: 440, padding: "lg", radius: "lg" } });
      return;
    }

    if (product.hasCustomization && !isBundle) {
      setOpened(true);
      return;
    }

    addToCartM.mutate(
      { productId: product.id, storeId: resolvedStore.id, cIds: [] },
      {
        onSuccess: (response) => response.data.cartCleared ? warning(response.message) : success(response.message),
        onError: (cause) => {
          handleStockApiError(cause, "This product could not be added. Refresh the menu and try again.");
          queryClient.invalidateQueries({ queryKey: catalogKeys.all });
          queryClient.invalidateQueries({ queryKey: cartKeys.all });
        },
      }
    );
  };

  const buttonLabel = isOutOfStock
    ? "Sold out"
    : isBundle
      ? "Add Combo"
    : !isLoggedIn
      ? "Sign in to add"
      : product.hasCustomization
        ? "Customize"
        : "Add to cart";

  return (
    <>
      <article className={`group flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-subtle transition-[transform,box-shadow,border-color] duration-200 ${isOutOfStock ? "opacity-85" : "hover:-translate-y-1 hover:border-brand/40 hover:shadow-subtle-hover focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25"}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
          {!imageFailed ? (
            <img
              src={`${BASE_URL}${product.image}`}
              alt={product.name}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035] ${isOutOfStock ? "grayscale-[50%]" : ""}`}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted" role="img" aria-label={`${product.name} image unavailable`}>
              <ImageOff size={30} aria-hidden="true" />
              <span className="text-xs font-medium">Image unavailable</span>
            </div>
          )}

          {product.veg !== null && <span className="absolute left-3 top-3"><DietaryMark vegetarian={product.veg} /></span>}
          {isLowStock && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-pill bg-amber-600/95 px-2.5 py-1 text-xs font-bold text-white shadow-subtle backdrop-blur-sm">
              Only {product.stockCount} left
            </span>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/50 backdrop-blur-[1px]">
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
            {isBundle && <BundleContents components={product.components ?? []} />}
            {product.hasCustomization && !isBundle && !isOutOfStock && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-basil"><Settings2 size={14} aria-hidden="true" /> Sizes and extras available</p>
            )}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            {isBundle ? <BundlePrice product={product} /> : <><p className="text-xs font-medium text-ink-muted">From</p><p className="mt-0.5 text-xl font-bold tabular-nums text-ink">{formatPaise(product.pricePaise)}</p></>}
            <Button
              fullWidth
              mt="md"
              size="md"
              disabled={isOutOfStock}
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
        <CustomizationDrawer product={product} close={() => setOpened(false)} />
      </Drawer>
    </>
  );
};

export default ProductCard;
