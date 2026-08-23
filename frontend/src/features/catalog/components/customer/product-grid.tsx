import { Pagination, Select, Skeleton } from "@mantine/core";
import { ArrowUpDown, MapPin, Pizza } from "lucide-react";
import { useSearchParams } from "react-router";
import ProductCard from "./product-card";
import { useGetProducts } from "../../api/product.queries";
import { LoadingRegion, ProductCardSkeleton, RefreshIndicator } from "@/shared/ui";
import { useStoreStore } from "@/features/store";

type ProductGridProps = {
  activeCategoryName?: string;
};

export const ProductGrid = ({ activeCategoryName }: ProductGridProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMenu = searchParams.get("menu");
  const sortBy = searchParams.get("sort") || "default";
  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const resolvedStore = useStoreStore((state) => state.resolvedStore);
  const isStoreResolved = useStoreStore((state) => state.isStoreResolved);
  const isStoreLoading = useStoreStore((state) => state.isLoading);
  const openPincodeModal = useStoreStore((state) => state.openPincodeModal);
  const { data, isLoading, isFetching } = useGetProducts({
    menuSlug: selectedMenu,
    page: String(page),
    sortBy,
    storeId: isStoreResolved ? resolvedStore?.id : undefined,
  });

  const updateParams = (changes: Record<string, string | null>) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.entries(changes).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      return next;
    });
  };

  if (isStoreLoading || isLoading) {
    return (
      <LoadingRegion label="Loading products" className="mt-9">
        <div className="mb-6 flex items-end justify-between gap-4"><div><Skeleton height={28} width={210} mb={8} /><Skeleton height={18} width={150} /></div><Skeleton height={42} width={190} radius="md" /></div>
        <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{[...Array(8)].map((_, index) => <ProductCardSkeleton key={index} />)}</div>
      </LoadingRegion>
    );
  }

  if (!isStoreResolved || !resolvedStore) {
    return (
      <div className="empty-state mt-9">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand"><MapPin size={30} aria-hidden="true" /></span>
        <h3 className="mt-4 text-section-title-scale">Choose your delivery area</h3>
        <p className="mt-2 max-w-md text-supporting-scale">Enter your pincode to see the products, availability, and prices for your nearest store.</p>
        <button type="button" onClick={openPincodeModal} className="primary-button mt-5 gap-2"><MapPin size={17} /> Enter delivery pincode</button>
      </div>
    );
  }

  const products = data?.data ?? [];
  const meta = data?.meta;

  if (products.length === 0) {
    return (
      <div className="empty-state mt-9">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand"><Pizza size={30} aria-hidden="true" /></span>
        <h3 className="mt-4 text-section-title-scale">Nothing on this tray yet</h3>
        <p className="mt-2 max-w-md text-supporting-scale">That selection is currently empty. Browse the full menu to find another favorite.</p>
        <button type="button" onClick={() => updateParams({ menu: null, page: null })} className="primary-button mt-5">View all pizzas</button>
      </div>
    );
  }

  const paginationTotal = meta ? meta.page + (meta.hasNextPage ? 1 : 0) : 1;

  return (
    <div className="mt-9" id="popular" aria-busy={isFetching}>
      <RefreshIndicator active={isFetching && !isLoading} label="Refreshing products" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">Ordering from {resolvedStore.name}</p>
          <h3 className="mt-1 text-section-title-scale">{activeCategoryName || "Popular right now"}</h3>
          <p className="mt-1 text-sm text-ink-muted">{products.length} {products.length === 1 ? "item" : "items"} on this page</p>
        </div>
        <Select
          aria-label="Sort menu items"
          leftSection={<ArrowUpDown size={17} aria-hidden="true" />}
          value={sortBy}
          onChange={(value) => updateParams({ sort: value === "default" ? null : value, page: null })}
          data={[
            { value: "default", label: "Recommended" },
            { value: "price_low", label: "Price: low to high" },
            { value: "price_high", label: "Price: high to low" },
          ]}
          className="w-full sm:w-52"
          allowDeselect={false}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => <ProductCard product={product} key={product.id} />)}
      </div>

      {paginationTotal > 1 && (
        <div className="mt-10 flex flex-col items-center gap-2">
          <Pagination
            value={page}
            total={paginationTotal}
            onChange={(nextPage) => updateParams({ page: nextPage === 1 ? null : String(nextPage) })}
            siblings={1}
            boundaries={1}
            aria-label="Menu pages"
          />
          <p className="text-xs text-ink-muted">Page {page}</p>
        </div>
      )}
    </div>
  );
};

export default ProductGrid;
