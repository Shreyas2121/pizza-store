import React from "react";
import { LucideIcon, PackageOpen } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) => {
  return (
    <div
      className={`empty-state ${className}`}
    >
      <div className="p-3.5 bg-brand-soft text-brand rounded-full mb-3 shadow-xs">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-semibold text-ink mb-1 font-sans">{title}</h3>
      {description && (
        <p className="text-sm text-ink-muted max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

export default EmptyState;
