import { Skeleton, Card } from "@mantine/core";

export const ProductCardSkeleton = () => {
  return (
    <Card shadow="sm" radius="lg" withBorder className="p-4 flex flex-col bg-surface border-border">
      <Skeleton height={160} radius="md" mb="md" />
      <Skeleton height={20} width="70%" radius="xs" mb="sm" />
      <Skeleton height={14} width="90%" radius="xs" mb="xs" />
      <Skeleton height={14} width="60%" radius="xs" mb="lg" />
      <div className="mt-auto flex justify-between items-center pt-2">
        <Skeleton height={24} width={60} radius="xs" />
        <Skeleton height={32} width={100} radius="md" />
      </div>
    </Card>
  );
};

export const ProductGridSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
};

export const CartSkeleton = () => {
  return (
    <div className="flex flex-col md:flex-row gap-6 my-6">
      <div className="flex-1 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} shadow="sm" radius="lg" withBorder className="p-4 flex gap-4 bg-surface border-border">
            <Skeleton height={80} width={80} radius="md" />
            <div className="flex-1 space-y-2">
              <Skeleton height={20} width="50%" radius="xs" />
              <Skeleton height={14} width="30%" radius="xs" />
              <Skeleton height={28} width={90} radius="sm" mt="xs" />
            </div>
          </Card>
        ))}
      </div>
      <div className="w-full md:w-1/3">
        <Card shadow="sm" radius="lg" withBorder className="p-5 space-y-4 bg-surface border-border">
          <Skeleton height={24} width="40%" radius="xs" />
          <Skeleton height={1} width="100%" />
          <div className="space-y-2">
            <Skeleton height={16} width="100%" radius="xs" />
            <Skeleton height={16} width="100%" radius="xs" />
          </div>
          <Skeleton height={44} width="100%" radius="md" mt="md" />
        </Card>
      </div>
    </div>
  );
};

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => {
  return (
    <Card shadow="sm" radius="lg" withBorder className="p-4 space-y-3 bg-surface border-border">
      <Skeleton height={36} width="100%" radius="sm" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={48} width="100%" radius="sm" />
      ))}
    </Card>
  );
};

export const ProfileSkeleton = () => {
  return (
    <div className="flex justify-center p-6 bg-canvas">
      <Card shadow="sm" radius="lg" withBorder className="max-w-sm w-full p-6 space-y-4 bg-surface border-border">
        <div className="flex justify-center">
          <Skeleton height={80} circle />
        </div>
        <Skeleton height={24} width="50%" radius="xs" className="mx-auto" />
        <div className="space-y-2 pt-2">
          <Skeleton height={16} width="80%" radius="xs" className="mx-auto" />
          <Skeleton height={16} width="70%" radius="xs" className="mx-auto" />
        </div>
        <Skeleton height={40} width="100%" radius="md" mt="md" />
      </Card>
    </div>
  );
};
