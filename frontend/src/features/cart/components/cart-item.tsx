import { Settings2, Trash2 } from "lucide-react";
import { ItemRes } from "../model/cart.types";
import QuantityStepper from "./quantity-stepper";
import { BASE_URL } from "@/shared/config";
import { formatPaise } from "@/shared/lib";

type CartItemProps = {
  item: ItemRes;
  updatingQuantity?: boolean;
  onQuantityChange: (type: "+" | "-") => void;
  onEditOptions?: () => void;
  onRemove: () => void;
};

export const CartItemCard = ({
  item,
  updatingQuantity,
  onQuantityChange,
  onEditOptions,
  onRemove,
}: CartItemProps) => {
  return (
    <article className="rounded-card border border-border bg-surface p-4 shadow-subtle sm:p-5">
      <div className="flex gap-4">
        <img
          className="h-20 w-20 shrink-0 rounded-control bg-surface-muted object-cover sm:h-24 sm:w-24"
          src={`${BASE_URL}${item.product.image}`}
          alt={item.product.name}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-card-title-scale">{item.product.name}</h2>
          <p className="mt-1 font-bold tabular-nums text-brand">
            {formatPaise(item.pricePaise)}
          </p>
          {item.customizations.length > 0 && (
            <ul
              className="mt-2 flex flex-wrap gap-1.5"
              aria-label="Selected customizations"
            >
              {item.customizations.map((customization) => (
                <li
                  key={customization.optionId}
                  className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs text-ink-muted"
                >
                  {customization.name}
                  {customization.pricePaise > 0 ? ` +${formatPaise(customization.pricePaise)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <QuantityStepper
          productName={item.product.name}
          quantity={item.quantity}
          disabled={updatingQuantity}
          onDecrease={() => onQuantityChange("-")}
          onIncrease={() => onQuantityChange("+")}
        />
        <div className="flex items-center gap-1">
          {item.product.hasCustomization && (
            <button
              type="button"
              onClick={onEditOptions}
              className="tertiary-button min-h-11 gap-1.5 text-sm"
            >
              <Settings2 size={16} /> Edit options
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="tertiary-button min-h-11 gap-1.5 text-sm hover:bg-red-50 hover:text-danger"
          >
            <Trash2 size={16} /> Remove
          </button>
        </div>
      </div>
    </article>
  );
};

export default CartItemCard;
