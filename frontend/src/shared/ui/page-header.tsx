import React from "react";

export interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({
  eyebrow,
  title,
  description,
  action,
  className = "",
}: PageHeaderProps) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border ${className}`}
    >
      <div className="space-y-1">
        {eyebrow && (
          <div className="text-xs font-semibold text-brand tracking-wider uppercase">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight font-sans">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-ink-muted max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-3 shrink-0">{action}</div>}
    </div>
  );
};

export default PageHeader;
