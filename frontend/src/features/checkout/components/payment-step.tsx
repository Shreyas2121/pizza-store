import { Check, CircleDollarSign, Truck } from "lucide-react";

export const PaymentStep = () => {
  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-subtle sm:p-6">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
          3
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-card-title-scale">Payment</h2>
            <CircleDollarSign size={18} className="text-brand" aria-hidden="true" />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Payment is collected when your order arrives.
          </p>
        </div>
      </div>
      <div className="ml-0 mt-5 flex items-center gap-3 rounded-card border border-basil/30 bg-basil-soft p-4 sm:ml-[52px]">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-basil">
          <Truck size={20} />
        </span>
        <div>
          <p className="font-semibold text-ink">Cash on delivery</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Pay the delivery partner when you receive your order.
          </p>
        </div>
        <Check className="ml-auto text-basil" size={20} />
      </div>
    </section>
  );
};

export default PaymentStep;
