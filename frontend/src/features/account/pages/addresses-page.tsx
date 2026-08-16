import { useState } from "react";
import { Button, Drawer, Skeleton } from "@mantine/core";
import { modals } from "@mantine/modals";
import { Building2, Home, MapPin, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import AddressForm from "../components/address-form";
import { useGetAddresses, useDeleteAddress } from "../api/address.queries";
import { Address } from "../model/account.types";
import { success } from "@/shared/lib";
import { PageHeader } from "@/shared/ui";


export const AddressesPage = () => {
  const { data: addresses, isLoading, isError } = useGetAddresses();
  const deleteAddressM = useDeleteAddress();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  const openCreate = () => { setEditing(null); setOpened(true); };
  const openEdit = (address: Address) => { setEditing(address); setOpened(true); };
  const closeDrawer = () => { setOpened(false); setEditing(null); };

  const confirmDelete = (address: Address) => {
    modals.openConfirmModal({
      title: "Delete saved address?",
      children: <p className="text-sm text-ink-muted">Remove the {address.type.toLowerCase()} address at {address.street}? This cannot be undone.</p>,
      labels: { confirm: "Delete address", cancel: "Keep address" },
      confirmProps: { color: "red" },
      centered: true,
      onConfirm: () => deleteAddressM.mutate(address.id, { onSuccess: (response) => success(response.message) }),
    });
  };

  if (isLoading) return <div className="space-y-5"><Skeleton height={82} radius="lg" /><div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((item) => <Skeleton key={item} height={220} radius="lg" />)}</div></div>;

  return (
    <section>
      <PageHeader eyebrow="Account" title="Saved addresses" description="Manage the delivery locations available during checkout." action={<Button leftSection={<Plus size={17} />} onClick={openCreate}>Add address</Button>} />

      {isError ? (
        <div className="empty-state m-0"><MapPin size={34} className="text-brand" /><h2 className="mt-3 text-section-title-scale">Addresses unavailable</h2><p className="mt-2 text-supporting-scale">Refresh the page to try again.</p></div>
      ) : !addresses?.length ? (
        <div className="empty-state m-0"><span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand"><MapPin size={30} /></span><h2 className="mt-4 text-section-title-scale">No saved addresses yet</h2><p className="mt-2 max-w-md text-supporting-scale">Save a delivery location now for a quicker checkout next time.</p><Button mt="lg" leftSection={<Plus size={17} />} onClick={openCreate}>Add your first address</Button></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {addresses.map((address, index) => {
            const TypeIcon = address.type === "Home" ? Home : address.type === "Work" ? Building2 : MapPin;
            return (
              <article key={address.id} className="flex min-h-56 flex-col rounded-card border border-border bg-surface p-5 shadow-subtle">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand"><TypeIcon size={21} aria-hidden="true" /></span>
                  {index === 0 && <span className="status-pill status-pill-basil normal-case tracking-normal">Default at checkout</span>}
                </div>
                <h2 className="mt-4 text-card-title-scale">{address.type}</h2>
                <address className="mt-2 flex-1 not-italic text-sm leading-6 text-ink-muted">
                  <p>{address.street}</p><p>{address.city}, {address.state} · {address.pincode}</p>
                  <p className="mt-2 flex items-center gap-2"><Phone size={15} aria-hidden="true" /><span className="sr-only">Phone:</span>{address.phone}</p>
                </address>
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  <Button variant="light" size="sm" leftSection={<Pencil size={15} />} onClick={() => openEdit(address)}>Edit</Button>
                  <Button variant="subtle" color="red" size="sm" leftSection={<Trash2 size={15} />} loading={deleteAddressM.isPending && deleteAddressM.variables === address.id} onClick={() => confirmDelete(address)}>Delete</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Drawer opened={opened} onClose={closeDrawer} position="right" size="100%" padding="lg" title="Delivery address" overlayProps={{ backgroundOpacity: 0.4, blur: 2 }} classNames={{ content: "md:max-w-[560px]" }}>
        <AddressForm
          addressId={editing?.id}
          defaultValues={editing ? { type: editing.type, street: editing.street, city: editing.city, state: editing.state, pincode: editing.pincode, phone: editing.phone } : undefined}
          onSubmit={closeDrawer}
        />
      </Drawer>
    </section>
  );
};

export default AddressesPage;
