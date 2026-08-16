import { CreateMenuItem } from "@/components/admin";
import { PageHeader } from "@/components/common";
import { MENU_API_HOOKS } from "@/hooks";
import { BASE_URL } from "@/lib";
import { useAuthModalStore } from "@/store";
import { Badge, Button, Skeleton } from "@mantine/core";
import { ImageOff, Plus } from "lucide-react";

const Menu = () => {
  const { data: menuItems, isLoading, isError } = MENU_API_HOOKS.useGetMenuItems();
  const { openModal } = useAuthModalStore();

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Menu sections"
        description="Control the order and grouping customers use to browse the catalogue."
        action={<Button color="brand" leftSection={<Plus size={16} />} onClick={() => openModal({ title: "Create menu section", content: <CreateMenuItem />, options: { size: "xl" } })}>Add section</Button>}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3,4].map((item) => <Skeleton key={item} h={160} radius="lg" />)}</div>
      ) : isError ? (
        <div className="surface-card p-8 text-center text-danger">Menu sections could not be loaded.</div>
      ) : menuItems?.length ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="hidden grid-cols-[72px_minmax(0,1fr)_120px_120px] items-center gap-4 bg-surface-muted px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted sm:grid">
            <span>Image</span><span>Section</span><span>Position</span><span>Status</span>
          </div>
          <div className="divide-y divide-border">
            {menuItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 p-4 sm:grid-cols-[72px_minmax(0,1fr)_120px_120px] sm:px-5">
                <div className="h-14 w-14 overflow-hidden rounded-xl bg-surface-muted">
                  {item.image ? <img src={`${BASE_URL}${item.image}`} alt="" className="h-full w-full object-cover" /> : <ImageOff className="m-auto mt-4 text-ink-muted" size={22} />}
                </div>
                <div><p className="font-semibold text-ink">{item.name}</p><p className="text-sm text-ink-muted">/{item.slug}</p></div>
                <div className="col-start-2 text-sm tabular-nums sm:col-auto"><span className="sm:hidden text-ink-muted">Position: </span>{item.position}</div>
                <div className="col-start-2 sm:col-auto"><Badge color={item.isActive ? "basil" : "gray"} variant="light">{item.isActive ? "Active" : "Inactive"}</Badge></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="surface-card flex flex-col items-center p-10 text-center"><ImageOff className="mb-3 text-ink-muted" /><p className="font-semibold">No menu sections yet</p><p className="mt-1 text-sm text-ink-muted">Create the first section to organize the storefront.</p></div>
      )}
    </div>
  );
};

export default Menu;
