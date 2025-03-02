import { Skeleton, Select } from "@mantine/core";
import { useGetProducts } from "../../../hooks/products";
import ProductCard from "./product-card";
import { useSearchParams } from "react-router";

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMenu = searchParams.get("menu");
  const sortBy = searchParams.get("sort") || "default";
  const page = searchParams.get("page") || "1";

  const { data, isLoading } = useGetProducts({
    menuSlug: selectedMenu,
    page,
    sortBy,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 p-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} height={250} radius="md" />
        ))}
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-6">
        No products available in this category.
      </p>
    );
  }

  const products = data.data;
  const meta = data.meta;

  return (
    <div className="mt-6">
      {/* Header with Sorting (Visible only when products exist) */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-xl font-semibold text-gray-800">Products</h2>
        <Select
          value={sortBy}
          onChange={(v) => {
            setSearchParams((prev) => {
              const params = Object.fromEntries(prev.entries());
              return { ...params, sort: v! };
            });
          }}
          data={[
            { value: "default", label: "Sort By: Default" },
            { value: "price_low", label: "Price: Low to High" },
            { value: "price_high", label: "Price: High to Low" },
          ]}
          size="sm"
          className="w-48"
        />
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {products.map((p) => (
          <ProductCard product={p} key={p.id} />
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
          disabled={page === "1"}
          onClick={() => {
            setSearchParams((prev) => {
              const params = Object.fromEntries(prev.entries());
              return { ...params, page: String(Number(page) - 1) };
            });
          }}
        >
          Previous
        </button>
        <span className="px-4 py-2 text-gray-700">Page {page}</span>
        <button
          disabled={!meta.hasNextPage}
          onClick={() => {
            setSearchParams((prev) => {
              const params = Object.fromEntries(prev.entries());
              return { ...params, page: String(Number(page) + 1) };
            });
          }}
          className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Products;
