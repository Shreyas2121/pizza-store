import { Group, Select, Stack } from "@mantine/core";
import type { PromotionDiscount } from "../model/promotion.types";
import { BASIS_POINTS_SCALE, MONEY_CAPS } from "../model/promotion.constants";
import { IntegerField, NullableIntegerField } from "./promotion-fields";
import { defaultDiscount } from "../model/promotion.helpers";
export const PromotionDiscountEditor = ({
  value,
  onChange,
  tier = false,
  coupon = false,
  label = "Discount type",
}: {
  value: PromotionDiscount;
  onChange: (discount: PromotionDiscount) => void;
  tier?: boolean;
  coupon?: boolean;
  label?: string;
}) => (
  <Stack gap="sm">
    <Select
      label={label}
      required
      allowDeselect={false}
      value={value.type}
      data={[
        { value: "percentage", label: "Percentage" },
        { value: "fixed_amount", label: "Fixed amount" },
        ...(!tier && !coupon
          ? [
              { value: "buy_x_get_y", label: "Buy X, get Y" },
              { value: "free_delivery", label: "Free delivery" },
            ]
          : []),
        ...(!tier ? [{ value: "tiered", label: "Tiered" }] : []),
      ]}
      onChange={(type) => {
        switch (type) {
          case "percentage":
          case "fixed_amount":
          case "buy_x_get_y":
          case "free_delivery":
          case "tiered":
            onChange(defaultDiscount(type));
        }
      }}
    />
    {value.type === "percentage" && (
      <Group grow align="start">
        <IntegerField
          label="Rate (basis points)"
          required
          min={1}
          max={BASIS_POINTS_SCALE}
          description="100 basis points = 1%."
          value={value.rateBps}
          onChange={(rateBps) => onChange({ ...value, rateBps })}
        />
        <NullableIntegerField
          label="Discount cap (paise)"
          min={1}
          max={MONEY_CAPS.DISCOUNT}
          value={value.maxDiscountPaise}
          onChange={(maxDiscountPaise) =>
            onChange({ ...value, maxDiscountPaise })
          }
        />
      </Group>
    )}
    {value.type === "fixed_amount" && (
      <IntegerField
        label="Discount amount (paise)"
        required
        min={1}
        max={MONEY_CAPS.DISCOUNT}
        description="100 paise = ₹1.00."
        value={value.amountPaise}
        onChange={(amountPaise) => onChange({ ...value, amountPaise })}
      />
    )}
  </Stack>
);
