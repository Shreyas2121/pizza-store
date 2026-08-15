import { DashCard } from "@/lib/types";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";

const DashboardCard = ({ card }: { card: DashCard }) => {
  const { current, previous, icon, isLow, percentage } = card.data;
  return (
    <div className="bg-white p-6 rounded-lg shadow hover:shadow-xl transition duration-300">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-gray-700">
          {card.label}
        </span>

        <DynamicIcon name={icon.name as any} size={24} color={icon.color} />
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-gray-900">{current}</p>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm text-gray-500">Previous: {previous}</p>
        <div className="flex items-center gap-1">
          {isLow ? (
            <ArrowDownRight className="text-red-500" />
          ) : (
            <ArrowUpRight className="text-green-500" />
          )}
          <span
            className={`text-sm font-medium ${
              isLow ? "text-red-500" : "text-green-500"
            }`}
          >
            {percentage}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DashboardCard;
