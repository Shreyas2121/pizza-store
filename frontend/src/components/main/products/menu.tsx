import { Skeleton } from "@mantine/core";
import { BASE_URL } from "../../../lib/constants";
import { useSearchParams } from "react-router";
import Products from "./products";
import { MENU_API_HOOKS } from "@/hooks";

const Menu = () => {
  const { data: menu, isLoading, error } = MENU_API_HOOKS. useGetMenuItems();

  const [searchParams, setSearchParams] = useSearchParams();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} height={200} radius="md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center text-red-500">Failed to load menu items.</p>
    );
  }

  const search = searchParams.get("menu");

  return (
    <div id="menu" className="container mx-auto scroll-mt-28 px-4 py-8">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">
        Our Menu
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {menu?.map((item) => {
          const active = search ? search === item.slug : false;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() =>
                setSearchParams((prev) => {
                  const params = Object.fromEntries(prev.entries());
                  return {
                    ...params,
                    menu: item.slug,
                  };
                })
              }
              aria-pressed={active}
              aria-label={`Select ${item.name} menu category`}
              className={`text-left bg-surface rounded-card border overflow-hidden shadow-subtle hover:shadow-subtle-hover transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer ${
                active
                  ? "border-brand ring-1 ring-brand bg-brand-soft/20"
                  : "border-border"
              }`}
            >
              <img
                src={`${BASE_URL}${item.image}`}
                alt={item.name}
                loading="lazy"
                className="w-full h-40 object-cover"
              />
              <div className="p-4 text-center">
                <h3 className="text-lg font-semibold text-ink font-sans">
                  {item.name}
                </h3>
              </div>
            </button>
          );
        })}
      </div>

      <Products />
    </div>
  );
};

export default Menu;
