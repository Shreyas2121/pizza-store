import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { DashCard } from "@/lib/types";

const DashboardCard = ({ card }: { card: DashCard }) => {
  const { current, previous, icon, isLow, percentage } = card.data;
  const neutral = percentage === "N/A";
  const tint = card.label === "Revenue" ? "bg-brand-soft text-brand" : card.label === "Total Orders" ? "bg-basil-soft text-basil" : card.label === "Active Users" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800";
  const TrendIcon = neutral ? Minus : isLow ? ArrowDownRight : ArrowUpRight;

  return (
    <article className="rounded-card border border-border bg-surface p-5 shadow-subtle" aria-label={`${card.label}: ${current}`}>
      <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-ink-muted">{card.label}</p><span className={`grid h-10 w-10 place-items-center rounded-control ${tint}`}><DynamicIcon name={icon.name as never} size={20} aria-hidden="true" /></span></div>
      <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums text-ink">{current}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="truncate text-ink-muted">Previous: {previous}</span><span className={`inline-flex shrink-0 items-center gap-1 font-bold ${neutral ? "text-ink-muted" : isLow ? "text-danger" : "text-basil"}`}><TrendIcon size={15} aria-hidden="true" />{percentage}</span></div>
    </article>
  );
};

export default DashboardCard;
