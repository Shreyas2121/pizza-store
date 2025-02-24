import { Button, Checkbox, Loader, Radio, Text } from "@mantine/core";
import { useGetProductCustomization } from "../hooks/products";
import { Group } from "../lib/types";
import { useEffect, useMemo, useState } from "react";
import { error, success } from "../lib/utils";
import { useAddToCart } from "../hooks/cart";

const Customize = ({
  id,
  price,
  close,
}: {
  id: number;
  price: number;
  close: () => void;
}) => {
  const { data, isLoading } = useGetProductCustomization(id);
  const addToCartM = useAddToCart();
  const [selectedOptions, setSelectedOptions] = useState<Record<number, any>>(
    {}
  );

  const handleChange = (group: Group, value: string[]) => {
    const selectedIds = value.map(Number); // Convert string values to numbers

    setSelectedOptions((prev) => {
      const updated = { ...prev };

      if (group.type === "single") {
        // Get the newly selected option
        const selectedOption = group.options.find(
          (o) => o.id === selectedIds[selectedIds.length - 1]
        );

        if (selectedOption) {
          // If required is false and user selects the same option again → deselect it
          if (!group.required && prev[group.id]?.id === selectedOption.id) {
            delete updated[group.id]; // Remove selection
          } else {
            updated[group.id] = selectedOption;
          }
        } else if (!group.required) {
          delete updated[group.id];
        }
      } else {
        // Multi-select: Store an array of selected option objects
        updated[group.id] = group.options.filter((o) =>
          selectedIds.includes(o.id)
        );
      }

      return updated;
    });
  };

  const { values, totalPrice } = useMemo(() => {
    const values = Object.values(selectedOptions)
      .flat()
      .map((opt: any) => String(opt.id));

    const totalPrice = Object.values(selectedOptions).reduce((prev, curr) => {
      if (Array.isArray(curr)) {
        return curr.reduce((prev1, curr) => prev1 + curr.price, prev);
      } else {
        return prev + curr.price;
      }
    }, 0);

    return { values, totalPrice: totalPrice + price };
  }, [selectedOptions]);

  useEffect(() => {
    const obj: any = {};
    if (data) {
      data.forEach((g) => {
        const group = g.group;
        if (group.required) {
          obj[group.id] = group.options[0];
        }
      });
    }

    setSelectedOptions(obj);
  }, [data]);

  if (isLoading) {
    return <Loader />;
  }

  const handleSubmit = async () => {
    const ids: number[] = [];

    Object.values(selectedOptions).forEach((op: any) => {
      if (Array.isArray(op)) {
        op.forEach((o) => ids.push(o.id));
      } else {
        ids.push(op.id);
      }
    });

    addToCartM.mutate(
      {
        productId: id,
        cIds: ids,
      },
      {
        onSuccess: (res) => {
          success(res.message);
          close();
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 ">
      {data && (
        <>
          {data.map((d) => {
            const group = d.group;
            const required = group.required;

            return (
              <div className="p-3 shadow-md bg-white border border-orange-500">
                <Checkbox.Group
                  value={values}
                  label={group.name}
                  withAsterisk={required}
                  onChange={(v) => handleChange(group, v)}
                >
                  <div className="flex flex-col gap-3 mt-3">
                    {group.options.map((opt) => {
                      return (
                        <Checkbox
                          value={String(opt.id)}
                          label={`${opt.name} ${
                            opt.price ? `₹${opt.price}` : ""
                          }`}
                        />
                      );
                    })}
                  </div>
                </Checkbox.Group>
              </div>
            );
          })}
        </>
      )}
      <div className="flex justify-between items-center p-3 mt-4 bg-gray-100 border border-gray-300 rounded-md">
        <Text size="lg">Total: ₹{totalPrice}</Text>
        <Button
          disabled={addToCartM.isPending}
          color="orange"
          onClick={handleSubmit}
        >
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default Customize;
