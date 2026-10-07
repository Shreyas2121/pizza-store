import { formatPaise } from "@/shared/lib";

export type PricingBreakdownData = {
  itemsSubtotalPaise: number; itemDiscountPaise: number; chargedDeliveryFeePaise: number;
  deliveryDiscountPaise: number; bundleMarkdownPaise: number; totalDisplayedSavingsPaise: number;
  roundingAdjustmentPaise: number; grandTotalPaise: number; taxPaise: number;
};
export function PricingBreakdown({ amounts }: { amounts: PricingBreakdownData }) {
  const row = (label: string, value: string, saving = false) => <div className={`flex justify-between gap-3 ${saving ? "text-basil" : "text-ink"}`}><dt>{label}</dt><dd className="tabular-nums">{value}</dd></div>;
  return <>
    <dl className="mt-5 space-y-3 text-sm">
      {row("Items subtotal", formatPaise(amounts.itemsSubtotalPaise))}
      {amounts.itemDiscountPaise > 0 && row("Item discount", `−${formatPaise(amounts.itemDiscountPaise)}`, true)}
      {row("Charged delivery", formatPaise(amounts.chargedDeliveryFeePaise))}
      {amounts.roundingAdjustmentPaise !== 0 && row("Rounding adjustment", formatPaise(amounts.roundingAdjustmentPaise))}
      {row("Included tax", formatPaise(amounts.taxPaise))}
      <div className="flex justify-between gap-3 border-t border-border pt-4 text-base font-bold"><dt>Total payable</dt><dd className="text-xl tabular-nums text-brand">{formatPaise(amounts.grandTotalPaise)}</dd></div>
    </dl>
    {amounts.totalDisplayedSavingsPaise > 0 && <div className="mt-4 rounded-control bg-basil-soft p-3">
      <p className="font-semibold">Your savings</p>
      <dl className="mt-2 space-y-2 text-sm">
        {row("Item savings", formatPaise(amounts.itemDiscountPaise), true)}
        {row("Delivery savings", formatPaise(amounts.deliveryDiscountPaise), true)}
        {row("Combo markdown", formatPaise(amounts.bundleMarkdownPaise), true)}
        {row("Total displayed savings", formatPaise(amounts.totalDisplayedSavingsPaise), true)}
      </dl>
      <p className="mt-2 text-xs text-ink-muted">Delivery savings are already reflected in charged delivery. Combo markdown compares regular and selling prices and is already included in the item prices above.</p>
    </div>}
  </>;
}
