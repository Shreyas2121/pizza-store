import { Button, Radio } from "@mantine/core";
import { Check, MapPin, Plus } from "lucide-react";
import { Address } from "@/features/account";

type AddressStepProps = {
  addresses: Address[] | undefined;
  selectedAddress: number | null;
  onSelectAddress: (id: number) => void;
  onOpenAddDrawer: () => void;
  servicePincode: string;
  disabled?: boolean;
};

export const AddressStep = ({
  addresses,
  selectedAddress,
  onSelectAddress,
  onOpenAddDrawer,
  servicePincode,
  disabled,
}: AddressStepProps) => {
  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-subtle sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
            2
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-card-title-scale">Delivery address</h2>
              <MapPin size={18} className="text-brand" aria-hidden="true" />
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Choose where this order should arrive.
            </p>
          </div>
        </div>
        <Button
          variant="light"
          size="sm"
          leftSection={<Plus size={16} />}
          onClick={onOpenAddDrawer}
          disabled={disabled}
        >
          Add address
        </Button>
      </div>

      {!addresses?.length ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenAddDrawer}
          className="ml-0 mt-5 flex min-h-28 w-full flex-col items-center justify-center rounded-card border border-dashed border-brand/40 bg-brand-soft/30 p-4 text-brand sm:ml-[52px] sm:w-[calc(100%-52px)]"
        >
          <Plus size={22} />
          <span className="mt-2 font-semibold">Add a delivery address</span>
        </button>
      ) : (
        <Radio.Group
          value={selectedAddress ? String(selectedAddress) : ""}
          onChange={(value) => onSelectAddress(Number(value))}
        >
          <div className="ml-0 mt-5 grid gap-3 sm:ml-[52px]">
            {addresses.map((address) => {
              const selected = selectedAddress === address.id;
              const isServed = address.pincode === servicePincode;
              return (
                <label
                  key={address.id}
                  className={`relative rounded-card border p-4 transition-colors ${!isServed ? "cursor-not-allowed border-border bg-surface-muted opacity-65" : selected ? "cursor-pointer border-brand bg-brand-soft/40 ring-1 ring-brand" : "cursor-pointer border-border bg-surface hover:border-brand/50"}`}
                >
                  <div className="flex items-start gap-3">
                    <Radio
                      value={String(address.id)}
                      mt={2}
                      aria-label={`Deliver to ${address.type} address`}
                      disabled={disabled || !isServed}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-ink">{address.type}</p>
                        {selected && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-brand">
                            <Check size={14} /> Selected
                          </span>
                        )}
                        {!isServed && <span className="text-xs font-bold text-danger">Outside {servicePincode}</span>}
                      </div>
                      <p className="mt-1 text-sm leading-5 text-ink-muted">
                        {address.street}, {address.city}, {address.state} ·{" "}
                        {address.pincode}
                      </p>
                      <p className="mt-1 text-sm text-ink-muted">{address.phone}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </Radio.Group>
      )}
    </section>
  );
};

export default AddressStep;
