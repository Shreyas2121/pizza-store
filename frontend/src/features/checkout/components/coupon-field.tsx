import { Button, TextInput } from "@mantine/core";
import { BadgePercent } from "lucide-react";
import { Coupon } from "../model/checkout.types";

type CouponFieldProps = {
  code: string;
  coupon: Coupon | null;
  loading?: boolean;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onRemove: () => void;
};

export const CouponField = ({
  code,
  coupon,
  loading,
  onCodeChange,
  onApply,
  onRemove,
}: CouponFieldProps) => {
  return (
    <div className="mt-4">
      <label
        htmlFor="coupon-code"
        className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"
      >
        <BadgePercent size={16} className="text-brand" /> Coupon code
      </label>
      <div className="flex gap-2">
        <TextInput
          id="coupon-code"
          value={code}
          onChange={(event) => onCodeChange(event.currentTarget.value.toUpperCase())}
          disabled={!!coupon || loading}
          placeholder="Enter code"
          className="min-w-0 flex-1"
        />
        <Button
          variant={coupon ? "light" : "filled"}
          color={coupon ? "red" : "brand"}
          loading={loading}
          onClick={() => (coupon ? onRemove() : onApply())}
        >
          {coupon ? "Remove" : "Apply"}
        </Button>
      </div>
      {coupon && (
        <p className="mt-2 text-xs font-semibold text-basil">
          {coupon.code} applied successfully
        </p>
      )}
    </div>
  );
};

export default CouponField;
