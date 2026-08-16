import { Accordion, Badge, Button } from "@mantine/core";
import { Boxes, PackagePlus, SlidersHorizontal } from "lucide-react";
import ProductAssignment from "../components/admin/product-assignment";
import { useGetAllCustomizations } from "../api/customization.queries";
import { formatPrice } from "@/shared/lib";
import { useAuthModalStore } from "@/shared/model";
import { ListSkeleton, PageHeader } from "@/shared/ui";


export const AdminCustomizationsPage = () => {
  const { data: groups, isLoading, isError } = useGetAllCustomizations();
  const { openModal } = useAuthModalStore();

  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="Customization groups" description="Review option groups and control which products offer each set of choices." />
      {isLoading ? <ListSkeleton rows={3} rowHeight={86} /> : isError ? (
        <div className="surface-card p-8 text-center text-danger">Customization groups could not be loaded.</div>
      ) : groups?.length ? (
        <Accordion variant="separated" radius="lg" defaultValue={String(groups[0]?.id)}>
          {groups.map((group) => (
            <Accordion.Item key={group.id} value={String(group.id)} className="overflow-hidden border-border bg-surface">
              <Accordion.Control icon={<SlidersHorizontal size={20} className="text-brand" />}>
                <div className="flex flex-wrap items-center gap-2 pr-3">
                  <span className="font-semibold text-ink">{group.name}</span>
                  <Badge size="sm" variant="light" color={group.required ? "brand" : "gray"}>{group.required ? "Required" : "Optional"}</Badge>
                  <Badge size="sm" variant="outline" color="gray">{group.type === "single" ? "Choose one" : "Choose multiple"}</Badge>
                  <span className="text-sm text-ink-muted">{group.options.length} options · {group.products.length} products</span>
                </div>
              </Accordion.Control>
              <Accordion.Panel>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Available options</p>
                    <div className="divide-y divide-border rounded-xl border border-border">
                      {group.options.length ? group.options.map((option) => (
                        <div key={option.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                          <div><p className="font-medium text-ink">{option.name}</p><p className="text-xs text-ink-muted">{option.isAvailable ? "Available" : "Unavailable"}</p></div>
                          <span className="font-medium tabular-nums text-ink-muted">{option.price ? `+${formatPrice(option.price)}` : "Included"}</span>
                        </div>
                      )) : <p className="p-4 text-sm text-ink-muted">No options have been added.</p>}
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface-muted p-4">
                    <div className="flex items-center gap-2"><Boxes size={18} /><p className="font-semibold">Assigned products</p></div>
                    <p className="mt-1 text-sm text-ink-muted">{group.products.length ? group.products.slice(0, 4).map((product) => product.name).join(", ") : "No products assigned"}{group.products.length > 4 ? ` and ${group.products.length - 4} more` : ""}</p>
                    <Button mt="md" fullWidth variant="default" leftSection={<PackagePlus size={16} />} onClick={() => openModal({ title: `Assign products to ${group.name}`, content: <ProductAssignment groupId={group.id} />, options: { size: "xl" } })}>Manage assignments</Button>
                  </div>
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      ) : (
        <div className="surface-card p-10 text-center"><SlidersHorizontal className="mx-auto mb-3 text-ink-muted" /><p className="font-semibold">No customization groups</p><p className="mt-1 text-sm text-ink-muted">Groups will appear here once configured.</p></div>
      )}
    </div>
  );
};

export default AdminCustomizationsPage;
