import { Banknote, CircleDollarSign, CreditCard, ShieldCheck } from "lucide-react";
import type { PaymentType } from "../model/checkout.types";

type PaymentStepProps = {
  value: PaymentType;
  onChange: (value: PaymentType) => void;
  disabled?: boolean;
};

const methods: Array<{
  value: PaymentType;
  title: string;
  description: string;
  icon: typeof Banknote;
}> = [
  {
    value: "cash",
    title: "Cash on delivery",
    description: "Pay the delivery partner when your order arrives.",
    icon: Banknote,
  },
  {
    value: "razorpay",
    title: "Pay online with Razorpay",
    description: "Use UPI, cards, netbanking, or supported wallets securely.",
    icon: CreditCard,
  },
];

export const PaymentStep = ({ value, onChange, disabled }: PaymentStepProps) => (
  <section className="rounded-card border border-border bg-surface p-5 shadow-subtle sm:p-6">
    <div className="flex gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
        3
      </span>
      <div>
        <div className="flex items-center gap-2">
          <h2 id="payment-method-title" className="text-card-title-scale">
            Payment
          </h2>
          <CircleDollarSign size={18} className="text-brand" aria-hidden="true" />
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Choose how you would like to pay for this order.
        </p>
      </div>
    </div>

    <fieldset
      className="ml-0 mt-5 grid gap-3 sm:ml-[52px]"
      aria-labelledby="payment-method-title"
      disabled={disabled}
    >
      <legend className="sr-only">Payment method</legend>
      {methods.map((method) => {
        const selected = value === method.value;
        const Icon = method.icon;
        return (
          <label
            key={method.value}
            className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-card border p-4 transition-colors focus-within:ring-2 focus-within:ring-brand/30 ${
              selected
                ? "border-brand bg-brand-soft/40"
                : "border-border hover:border-brand/50"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="radio"
              name="payment-method"
              value={method.value}
              checked={selected}
              onChange={() => onChange(method.value)}
              className="h-4 w-4 accent-brand"
            />
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-brand">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{method.title}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">
                {method.description}
              </span>
            </span>
            {method.value === "razorpay" && (
              <ShieldCheck className="shrink-0 text-basil" size={20} aria-hidden="true" />
            )}
          </label>
        );
      })}
    </fieldset>
  </section>
);

export default PaymentStep;
