import { Button, TextInput } from "@mantine/core";
import { BadgePercent } from "lucide-react";

type CouponFieldProps = {
  code: string;
  appliedCouponCode: string | null;
  loading?: boolean;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onRemove: () => void;
};

export const CouponField = ({
  code,
  appliedCouponCode,
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
          disabled={!!appliedCouponCode || loading}
          placeholder="Enter code"
          className="min-w-0 flex-1"
        />
        <Button
          variant={appliedCouponCode ? "light" : "filled"}
          color={appliedCouponCode ? "red" : "brand"}
          loading={loading}
          onClick={() => (appliedCouponCode ? onRemove() : onApply())}
        >
          {appliedCouponCode ? "Remove" : "Apply"}
        </Button>
      </div>
      {appliedCouponCode && (
        <p className="mt-2 text-xs font-semibold text-basil">
          {appliedCouponCode} applied successfully
        </p>
      )}
    </div>
  );
};

export default CouponField;
