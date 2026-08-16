import { Pizza } from "lucide-react";
import { Link } from "react-router";

type BrandLockupProps = {
  inverse?: boolean;
  onClick?: () => void;
};

export const BrandLockup = ({ inverse = false, onClick }: BrandLockupProps) => (
  <Link
    to="/"
    onClick={onClick}
    className="group inline-flex items-center gap-2.5 rounded-control focus-visible:outline-none"
    aria-label="PizzaStore home"
  >
    <span
      className={`grid h-10 w-10 place-items-center rounded-full transition-transform duration-200 group-hover:-rotate-6 ${
        inverse ? "bg-surface text-brand" : "bg-brand text-white"
      }`}
      aria-hidden="true"
    >
      <Pizza size={22} strokeWidth={2.25} />
    </span>
    <span className={`font-display text-2xl leading-none tracking-tight ${inverse ? "text-surface" : "text-ink"}`}>
      PizzaStore
    </span>
  </Link>
);

export default BrandLockup;
