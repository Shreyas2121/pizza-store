import { Skeleton } from "@mantine/core";
import { useGetMenuItems } from "../../../hooks/menu";
import { BASE_URL } from "../../../lib/constants";
import { useSearchParams } from "react-router";
import Products from "./products";

const Menu = () => {
  const { data: menu, isLoading, error } = useGetMenuItems();

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
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        Our Menu
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {menu?.map((item) => {
          const active = search ? search === item.slug : false;
          return (
            <div
              key={item.id}
              onClick={(e) =>
                setSearchParams((prev) => {
                  const params = Object.fromEntries(prev.entries());
                  return {
                    ...params,
                    menu: item.slug,
                  };
                })
              }
              className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition
                ${active && "border border-orange-500"}
                `}
            >
              <img
                src={`${BASE_URL}${item.image}`}
                alt={item.name}
                loading="lazy"
                className="w-full h-40 object-cover"
              />
              <div className="p-4 text-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  {item.name}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      <Products />
    </div>
  );
};

export default Menu;
