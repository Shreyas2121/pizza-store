import { Tooltip } from "@mantine/core";
import { Minus, Plus } from "lucide-react";

type QuantityStepperProps = {
  productName: string;
  quantity: number;
  disabled?: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
};

export const QuantityStepper = ({
  productName,
  quantity,
  disabled,
  onDecrease,
  onIncrease,
}: QuantityStepperProps) => (
  <div
    className="inline-flex items-center overflow-hidden rounded-control border border-border bg-surface"
    aria-label={`Quantity for ${productName}`}
  >
    <Tooltip label="Decrease quantity">
      <button
        type="button"
        className="grid h-11 w-11 place-items-center text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-40"
        disabled={disabled}
        onClick={onDecrease}
        aria-label={`Decrease ${productName} quantity`}
      >
        <Minus size={16} />
      </button>
    </Tooltip>
    <span
      className="grid h-11 min-w-11 place-items-center border-x border-border text-sm font-bold tabular-nums text-ink"
      aria-live="polite"
    >
      {quantity}
    </span>
    <Tooltip label="Increase quantity">
      <button
        type="button"
        className="grid h-11 w-11 place-items-center text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-40"
        disabled={disabled}
        onClick={onIncrease}
        aria-label={`Increase ${productName} quantity`}
      >
        <Plus size={16} />
      </button>
    </Tooltip>
  </div>
);

export default QuantityStepper;
