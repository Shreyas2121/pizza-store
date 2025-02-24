import { OrderStatus as OS } from "../lib/types";
import { Clock, Loader2, CheckCircle, XCircle } from "lucide-react";

const OrderStatus = ({ status }: { status: OS }) => {
  const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);

  let IconComponent;
  let colorClass = "";
  let animationClass = "";

  switch (status) {
    case "pending":
      IconComponent = Clock;
      colorClass = "text-yellow-500";
      break;
    case "preparing":
      IconComponent = Loader2;
      colorClass = "text-blue-500";
      animationClass = "animate-spin";
      break;
    case "delievered":
      IconComponent = CheckCircle;
      colorClass = "text-green-500";
      break;
    case "cancelled":
      IconComponent = XCircle;
      colorClass = "text-red-500";
      break;
    default:
      IconComponent = Clock;
      colorClass = "text-gray-500";
  }

  return (
    <div className="flex items-center gap-2">
      <IconComponent size={20} className={`${colorClass} ${animationClass}`} />
      <span className="font-semibold text-gray-800">{formattedStatus}</span>
    </div>
  );
};

export default OrderStatus;
