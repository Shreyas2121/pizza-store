import React from "react";

import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { cap, ChatStatus } from "@/lib";

type Props = {
  status: ChatStatus;
};

const SupportStatus: React.FC<Props> = ({ status }) => {
  let icon;
  let textColor = "text-gray-700"; // default color

  switch (status) {
    case "open":
      icon = <CheckCircle2 className="text-green-500 w-5 h-5" />;
      textColor = "text-green-600";
      break;
    case "close":
      icon = <XCircle className="text-gray-400 w-5 h-5" />;
      textColor = "text-gray-500";
      break;
    case "rejected":
      icon = <AlertCircle className="text-red-500 w-5 h-5" />;
      textColor = "text-red-600";
      break;
    case "pending":
      icon = <Loader2 className="text-yellow-500 w-5 h-5 animate-spin" />;
      textColor = "text-yellow-600";
      break;
    default:
      icon = <Loader2 className="text-gray-400 w-5 h-5 animate-spin" />;
      break;
  }

  return (
    <div className="flex items-center space-x-2">
      {icon}
      <span className={`${textColor} capitalize`}>{cap(status)}</span>
    </div>
  );
};

export default SupportStatus;
