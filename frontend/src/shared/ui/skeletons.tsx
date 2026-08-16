import { Card, Skeleton } from "@mantine/core";
import type { ReactNode } from "react";

interface LoadingRegionProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

export const LoadingRegion = ({
  children,
  label = "Loading content",
  className = "",
}: LoadingRegionProps) => (
  <div
    role="status"
    aria-busy="true"
    aria-live="polite"
    className={className}
  >
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">{children}</div>
  </div>
);

export const RefreshIndicator = ({ active, label = "Refreshing content" }: { active: boolean; label?: string }) => {
  if (!active) return null;

  return (
    <div className="h-0" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="relative z-20 h-0.5 w-full overflow-hidden rounded-full bg-brand/15">
        <span className="block h-full w-1/3 animate-pulse rounded-full bg-brand" />
      </div>
    </div>
  );
};

export const PageHeaderSkeleton = () => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="space-y-2">
      <Skeleton height={10} width={110} radius="xl" />
      <Skeleton height={34} width={230} radius="sm" />
      <Skeleton height={16} width="min(520px, 75vw)" radius="xl" />
    </div>
    <Skeleton height={42} width={150} radius="md" />
  </div>
);

export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <LoadingRegion label="Loading table">
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton height={40} width="min(320px, 100%)" radius="md" />
        <Skeleton height={40} width={176} radius="md" />
      </div>
      <div className="hidden border-b border-border bg-surface-muted/70 px-4 py-3 md:grid md:grid-cols-5 md:gap-5">
        {[55, 70, 48, 62, 38].map((width, index) => (
          <Skeleton key={index} height={11} width={`${width}%`} radius="xl" />
        ))}
      </div>
      <div className="divide-y divide-border px-4">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid min-h-[58px] grid-cols-2 items-center gap-4 md:grid-cols-5 md:gap-5">
            {[72, 58, 80, 52, 65].map((width, cellIndex) => (
              <Skeleton
                key={cellIndex}
                height={cellIndex === 0 ? 16 : 12}
                width={`${width}%`}
                radius="xl"
                className={cellIndex > 1 ? "hidden md:block" : ""}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <Skeleton height={14} width={76} radius="xl" />
        <div className="flex gap-2"><Skeleton height={40} width={40} radius="md" /><Skeleton height={40} width={40} radius="md" /></div>
      </div>
    </div>
  </LoadingRegion>
);

interface CardGridSkeletonProps {
  count?: number;
  height?: number;
  className?: string;
  label?: string;
}

export const CardGridSkeleton = ({
  count = 4,
  height = 160,
  className = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
  label = "Loading cards",
}: CardGridSkeletonProps) => (
  <LoadingRegion label={label}>
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} height={height} radius="lg" />
      ))}
    </div>
  </LoadingRegion>
);

export const ListSkeleton = ({ rows = 4, rowHeight = 72 }: { rows?: number; rowHeight?: number }) => (
  <LoadingRegion label="Loading list">
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} height={rowHeight} radius="lg" />
      ))}
    </div>
  </LoadingRegion>
);

export const ChartSkeleton = ({ height = 320 }: { height?: number }) => (
  <LoadingRegion label="Loading chart">
    <div className="relative overflow-hidden rounded-lg" style={{ height }}>
      <Skeleton height="100%" radius="lg" />
      <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3 opacity-50">
        {[42, 70, 54, 88, 64, 76, 48].map((barHeight, index) => (
          <Skeleton key={index} height={`${barHeight}%`} className="flex-1" radius="sm" />
        ))}
      </div>
    </div>
  </LoadingRegion>
);

export const DetailsPageSkeleton = ({ admin = false }: { admin?: boolean }) => (
  <LoadingRegion label="Loading details">
    <div className={`${admin ? "mx-auto max-w-5xl" : ""} space-y-5`}>
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} height={104} radius="lg" />)}
      </div>
      <Skeleton height={150} radius="lg" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton height={320} radius="lg" />
        <Skeleton height={320} radius="lg" />
      </div>
    </div>
  </LoadingRegion>
);

export const RouteSkeleton = ({ admin = false }: { admin?: boolean }) => (
  <LoadingRegion label="Loading page">
    <div className={admin ? "" : "page-shell py-8"}>
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton height={180} radius="lg" />
        <Skeleton height={180} radius="lg" />
        <Skeleton height={180} radius="lg" />
      </div>
    </div>
  </LoadingRegion>
);

export const ProductCardSkeleton = () => (
  <Card shadow="sm" radius="lg" withBorder className="flex flex-col border-border bg-surface p-4">
    <Skeleton height={160} radius="md" mb="md" />
    <Skeleton height={20} width="70%" radius="xs" mb="sm" />
    <Skeleton height={14} width="90%" radius="xs" mb="xs" />
    <Skeleton height={14} width="60%" radius="xs" mb="lg" />
    <div className="mt-auto flex items-center justify-between pt-2">
      <Skeleton height={24} width={60} radius="xs" />
      <Skeleton height={32} width={100} radius="md" />
    </div>
  </Card>
);

export const ProductGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <LoadingRegion label="Loading products">
    <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => <ProductCardSkeleton key={index} />)}
    </div>
  </LoadingRegion>
);

export const CartSkeleton = () => (
  <LoadingRegion label="Loading cart">
    <div className="my-6 flex flex-col gap-6 md:flex-row">
      <div className="flex-1 space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} shadow="sm" radius="lg" withBorder className="flex gap-4 border-border bg-surface p-4">
            <Skeleton height={80} width={80} radius="md" />
            <div className="flex-1 space-y-2"><Skeleton height={20} width="50%" radius="xs" /><Skeleton height={14} width="30%" radius="xs" /><Skeleton height={28} width={90} radius="sm" mt="xs" /></div>
          </Card>
        ))}
      </div>
      <Card shadow="sm" radius="lg" withBorder className="h-fit w-full space-y-4 border-border bg-surface p-5 md:w-1/3">
        <Skeleton height={24} width="40%" radius="xs" /><Skeleton height={1} width="100%" /><Skeleton height={16} width="100%" radius="xs" /><Skeleton height={16} width="100%" radius="xs" /><Skeleton height={44} width="100%" radius="md" mt="md" />
      </Card>
    </div>
  </LoadingRegion>
);

export const ProfileSkeleton = () => (
  <LoadingRegion label="Loading profile">
    <div className="space-y-5"><Skeleton height={82} radius="lg" /><Skeleton height={260} radius="lg" /></div>
  </LoadingRegion>
);
