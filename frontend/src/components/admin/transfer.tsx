import { useGetProductsA, useGetProductsByGroup } from "@/hooks/products";
import { Button } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

interface Product {
  id: number;
  name: string;
}

const Transfer = ({ groupId }: { groupId: number }) => {
  const { data: groupedProducts, isLoading: loadingG } =
    useGetProductsByGroup(groupId);

  const { data: products, isLoading: loadingP } = useGetProductsA();

  const [assigned, setAssigned] = useState<
    {
      id: number;
      name: string;
    }[]
  >([]);

  const allProducts = products || [];
  const assignedProducts = assigned || [];

  const unassignedProducts = useMemo(() => {
    return allProducts.filter(
      (p) => !assignedProducts.some((ap) => ap.id === p.id)
    );
  }, [allProducts, assignedProducts]);

  useEffect(() => {
    if (groupedProducts) {
      setAssigned(groupedProducts);
    }
  }, [groupedProducts]);

  if (loadingG || loadingP) {
    return <div className="p-4">Loading...</div>;
  }

  const handleAdd = (product: Product) => {
    setAssigned((prev) => [...prev, product]);
  };

  const handleRemove = (product: Product) => {
    setAssigned((prev) => prev.filter((ap) => ap.id !== product.id));
  };

  const handleAddAll = () => {
    setAssigned(allProducts);
  };

  const handleRemoveAll = () => {
    setAssigned([]);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-6">
        Transfer Products to Group {groupId}
      </h2>
      <div className="grid grid-cols-2 gap-8">
        {/* Unassigned Products */}
        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg">Available Products</h3>
            <Button variant="default" size="xs" onClick={handleAddAll}>
              Add All
            </Button>
          </div>
          <div className="h-80 overflow-y-auto">
            {unassignedProducts.length ? (
              <ul className="space-y-2">
                {unassignedProducts.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between"
                  >
                    <span>{product.name}</span>
                    <Button
                      variant="filled"
                      color="blue"
                      size="xs"
                      onClick={() => handleAdd(product)}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No available products.</p>
            )}
          </div>
        </div>
        {/* Assigned Products */}
        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg">Assigned Products</h3>
            <Button variant="default" size="xs" onClick={handleRemoveAll}>
              Remove All
            </Button>
          </div>
          <div className="h-80 overflow-y-auto">
            {assignedProducts.length ? (
              <ul className="space-y-2">
                {assignedProducts.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between"
                  >
                    <span>{product.name}</span>
                    <Button
                      variant="filled"
                      color="red"
                      size="xs"
                      onClick={() => handleRemove(product)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No products assigned.</p>
            )}
          </div>
        </div>
      </div>
      <Button className="w-full mt-5" onClick={() => {}}>
        Update
      </Button>
    </div>
  );
};

export default Transfer;
