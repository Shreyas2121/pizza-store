import { Card, Skeleton } from "@mantine/core";
import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { routeLoadingLayout } from "./route-loading";

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
      <Skeleton height={34} width="min(230px, 100%)" radius="sm" />
      <Skeleton height={16} width="min(520px, 75vw)" radius="xl" />
    </div>
    <Skeleton height={42} width={150} radius="md" />
  </div>
);

export const TableSkeleton = ({ rows = 6, label = "Loading table", toolbar = true }: { rows?: number; label?: string; toolbar?: boolean }) => (
  <LoadingRegion label={label}>
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      {toolbar && <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton height={40} width="min(320px, 100%)" radius="md" />
        <Skeleton height={40} width={176} radius="md" />
      </div>}
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
      {toolbar && <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <Skeleton height={14} width={76} radius="xl" />
        <div className="flex gap-2"><Skeleton height={40} width={40} radius="md" /><Skeleton height={40} width={40} radius="md" /></div>
      </div>}
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
        <div key={index} className="space-y-4 rounded-2xl border border-border bg-surface p-5" style={{ minHeight: height }}>
          <Skeleton height={14} width="55%" />
          <Skeleton height={28} width="72%" />
          <Skeleton height={12} width="90%" />
          {height > 180 && <Skeleton height={40} width="100%" mt="xl" />}
        </div>
      ))}
    </div>
  </LoadingRegion>
);

export const ListSkeleton = ({ rows = 4, rowHeight = 72, label = "Loading list" }: { rows?: number; rowHeight?: number; label?: string }) => (
  <LoadingRegion label={label}>
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4" style={{ minHeight: rowHeight }}>
          <Skeleton height={36} width={36} className="shrink-0" />
          <div className="min-w-0 flex-1 space-y-3"><Skeleton height={14} width="65%" /><Skeleton height={10} width="85%" /></div>
          <Skeleton height={24} width={60} className="shrink-0" />
        </div>
      ))}
    </div>
  </LoadingRegion>
);

export const ChartSkeleton = ({ height = 320 }: { height?: number }) => (
  <LoadingRegion label="Loading chart">
    <div className="relative overflow-hidden rounded-lg" style={{ height }}>
      <div className="absolute inset-5 flex items-end justify-between gap-3 border-b border-l border-border pb-2 pl-2">
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
      <div className="rounded-2xl border border-border bg-surface p-5"><PanelSkeleton rows={2} /></div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-border bg-surface p-5"><PanelSkeleton rows={4} /></div>
        <div className="rounded-2xl border border-border bg-surface p-5"><PanelSkeleton rows={4} /></div>
      </div>
    </div>
  </LoadingRegion>
);

/** For drawer/modal bodies and small panels; use page skeletons for full screens. */
export const PanelSkeleton = ({ label = "Loading details", rows = 4, form = false }: { label?: string; rows?: number; form?: boolean }) => (
  <LoadingRegion label={label}>
    <div className="space-y-5 py-3">
      <Skeleton height={24} width="60%" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton height={12} width={`${40 + (index % 3) * 15}%`} />
          <Skeleton height={form ? 42 : 16} width="100%" />
        </div>
      ))}
      {form && <Skeleton height={42} width={140} />}
    </div>
  </LoadingRegion>
);

export const ReportSkeleton = ({ label = "Loading report" }: { label?: string }) => (
  <div className="space-y-5">
    <CardGridSkeleton label={label} height={120} />
    <TableSkeleton rows={5} toolbar={false} label="Loading report rows" />
  </div>
);

export const RouteSkeleton = ({ admin = false, contained = false }: { admin?: boolean; contained?: boolean }) => {
  const { pathname } = useLocation();
  const layout = routeLoadingLayout(pathname);
  return <div className={admin || contained ? "" : "page-shell py-8"}>
    {layout !== "details" && layout !== "profile" && layout !== "checkout" && <PageHeaderSkeleton />}
    {layout === "products" && <ProductGridSkeleton />}
    {layout === "cart" && <CartSkeleton />}
    {layout === "checkout" && <CheckoutSkeleton />}
    {layout === "profile" && <ProfileSkeleton />}
    {layout === "cards" && <CardGridSkeleton count={3} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" />}
    {layout === "list" && <ListSkeleton rows={4} rowHeight={90} />}
    {layout === "details" && <DetailsPageSkeleton admin={admin} />}
    {layout === "form" && <PanelSkeleton form rows={5} label="Loading page" />}
    {layout === "report" && <ReportSkeleton />}
    {layout === "table" && <TableSkeleton />}
    {layout === "chat" && <ListSkeleton rows={6} rowHeight={64} label="Loading conversation" />}
  </div>;
};

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

export const CheckoutSkeleton = () => (
  <LoadingRegion label="Loading checkout">
    <PageHeaderSkeleton />
    <div className="mb-5 rounded-2xl border border-border bg-surface p-4"><PanelSkeleton rows={1} /></div>
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        {[2, 3, 2].map((rows, index) => <div key={index} className="rounded-2xl border border-border bg-surface p-5"><PanelSkeleton rows={rows} /></div>)}
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5"><PanelSkeleton form rows={5} /></div>
    </div>
  </LoadingRegion>
);

export const ProfileSkeleton = () => (
  <LoadingRegion label="Loading profile">
    <div className="space-y-5"><PageHeaderSkeleton /><div className="rounded-2xl border border-border bg-surface p-5"><PanelSkeleton form rows={4} /></div></div>
  </LoadingRegion>
);
