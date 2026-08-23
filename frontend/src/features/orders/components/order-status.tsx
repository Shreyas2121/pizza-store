import { CheckCircle2, ChefHat, Clock3, WalletCards, XCircle } from "lucide-react";
import { OrderStatus as OS } from "../model/order.types";

export const getOrderStatusMeta = (status: OS) => {
  switch (status) {
    case "awaiting_payment":
      return { label: "Awaiting payment", icon: WalletCards, className: "bg-amber-100 text-amber-800" };
    case "preparing":
      return { label: "Preparing", icon: ChefHat, className: "bg-blue-100 text-blue-800" };
    case "delivered":
    case "delievered":
      return { label: "Delivered", icon: CheckCircle2, className: "bg-basil-soft text-basil" };
    case "cancelled":
      return { label: "Cancelled", icon: XCircle, className: "bg-red-100 text-danger" };
    default:
      return { label: "Pending", icon: Clock3, className: "bg-amber-100 text-amber-800" };
  }
};

export const OrderStatus = ({ status }: { status: OS }) => {
  const meta = getOrderStatusMeta(status);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-bold ${meta.className}`}>
      <Icon size={15} aria-hidden="true" />
      {meta.label}
    </span>
  );
};

export default OrderStatus;
