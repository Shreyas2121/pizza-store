import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { Link } from "react-router";
import { DashCard } from "../model/dashboard.types";

export const DashboardCard = ({ card }: { card: DashCard }) => {
  const { current, previous, icon, isLow, percentage } = card.data;
  const isLowStockCard = card.label === "Low Stock Items";
  const neutral = percentage === "N/A";
  const tint =
    card.label === "Revenue"
      ? "bg-brand-soft text-brand"
      : card.label === "Total Orders"
        ? "bg-basil-soft text-basil"
        : card.label === "Active Users"
          ? "bg-blue-100 text-blue-700"
          : card.label === "Low Stock Items"
            ? isLow
              ? "bg-red-100 text-red-700"
              : "bg-surface-muted text-ink-muted"
            : "bg-amber-100 text-amber-800";
  const TrendIcon = neutral ? Minus : isLow ? ArrowDownRight : ArrowUpRight;

  const content = (
    <article
      className={`rounded-card border border-border bg-surface p-5 shadow-subtle transition-[border-color,box-shadow] duration-150 ${
        isLowStockCard
          ? "hover:border-amber-400 hover:shadow-subtle-hover cursor-pointer"
          : ""
      }`}
      aria-label={`${card.label}: ${current}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink-muted">{card.label}</p>
        <span
          className={`grid h-10 w-10 place-items-center rounded-control ${tint}`}
        >
          <DynamicIcon name={icon.name as never} size={20} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums text-ink">
        {current}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-ink-muted">
          {isLowStockCard ? "Threshold or zero" : `Previous: ${previous}`}
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 font-bold ${
            isLowStockCard
              ? isLow
                ? "text-danger"
                : "text-ink-muted"
              : neutral
                ? "text-ink-muted"
                : isLow
                  ? "text-danger"
                  : "text-basil"
          }`}
        >
          {!neutral && !isLowStockCard && (
            <TrendIcon size={15} aria-hidden="true" />
          )}
          {isLowStockCard ? "View stock" : percentage}
        </span>
      </div>
    </article>
  );

  if (isLowStockCard) {
    return (
      <Link
        to="/admin/inventory?status=low_stock"
        className="block rounded-card focus:outline-none focus:ring-2 focus:ring-brand/30"
      >
        {content}
      </Link>
    );
  }

  return content;
};

export default DashboardCard;
