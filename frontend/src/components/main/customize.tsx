import { Button, Checkbox, Loader, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { CART_API_HOOKS, PRODUCTS_HOOKS } from "@/hooks";
import { Group, Option, success } from "@/lib";

const Customize = ({
  id,
  price,
  close,
}: {
  id: number;
  price: number;
  close: () => void;
}) => {
  const { data, isLoading } = PRODUCTS_HOOKS.useGetProductCustomization(id);
  const addToCartM = CART_API_HOOKS.useAddToCart();
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, Option | Option[]>
  >({});

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
          const currentPrev = prev[group.id];
          if (
            !group.required &&
            !Array.isArray(currentPrev) &&
            currentPrev?.id === selectedOption.id
          ) {
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
      .map((opt: Option) => String(opt.id));

    const totalPrice = Object.values(selectedOptions).reduce((prev, curr) => {
      if (Array.isArray(curr)) {
        return curr.reduce((prev1, currOpt) => prev1 + (currOpt.price || 0), prev);
      } else {
        return prev + ((curr as Option)?.price || 0);
      }
    }, 0);

    return { values, totalPrice: totalPrice + price };
  }, [selectedOptions, price]);

  useEffect(() => {
    const obj: Record<number, Option | Option[]> = {};
    if (data) {
      data.forEach((g) => {
        const group = g.group;
        if (group.required && group.options.length > 0) {
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

    Object.values(selectedOptions).forEach((op: Option | Option[]) => {
      if (Array.isArray(op)) {
        op.forEach((o) => ids.push(o.id));
      } else if (op) {
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
              <div
                key={group.id}
                className="p-3.5 shadow-sm bg-surface border border-border rounded-lg"
              >
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
                          key={opt.id}
                          value={String(opt.id)}
                          label={`${opt.name} ${
                            opt.price ? `₹${opt.price}` : ""
                          }`}
                          color="brand"
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
      <div className="flex justify-between items-center p-3.5 mt-4 bg-surface-muted border border-border rounded-lg">
        <Text size="lg" className="font-semibold text-ink">Total: ₹{totalPrice}</Text>
        <Button
          loading={addToCartM.isPending}
          color="brand"
          onClick={handleSubmit}
        >
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default Customize;
