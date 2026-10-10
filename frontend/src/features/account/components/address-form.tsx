import { Controller, useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, Select, TextInput } from "@mantine/core";
import { Home, MapPin, Phone } from "lucide-react";
import { useCreateAddress, useUpdateAddress } from "../api/address.queries";
import { addressSchema, TAddress } from "../model/address.schema";
import { success, warning } from "@/shared/lib";
import { useStoreStore } from "@/features/store";

export const AddressForm = ({ addressId, defaultValues, onSubmit: afterSubmit }: { addressId?: number; defaultValues?: TAddress; onSubmit?: () => void }) => {
  const createAddressM = useCreateAddress();
  const updateAddressM = useUpdateAddress();
  const isPending = createAddressM.isPending || updateAddressM.isPending;
  const setPincode = useStoreStore((state) => state.setPincode);
  const openPincodeModal = useStoreStore((state) => state.openPincodeModal);
  const { control, register, handleSubmit, formState: { errors } } = useForm<TAddress>({
    resolver: standardSchemaResolver(addressSchema),
    defaultValues: defaultValues ?? { type: "Home", street: "", city: "", state: "", pincode: "", phone: "" },
  });

  const onSubmit = (data: TAddress) => {
    const mutation = addressId ? updateAddressM : createAddressM;
    const payload = addressId ? { id: addressId, data } : data;
    mutation.mutate(payload as never, {
      onSuccess: async (response: { message: string }) => {
        success(response.message);
        if (!addressId) {
          const store = await setPincode(data.pincode);
          if (!store) {
            warning("Address saved, but no available store serves its pincode.");
            openPincodeModal();
          }
        }
        afterSubmit?.();
      },
    });
  };

  return (
    <div>
      <div className="mb-6">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand"><MapPin size={22} aria-hidden="true" /></span>
        <h2 className="mt-4 text-page-title-scale">{addressId ? "Edit delivery address" : "Add a delivery address"}</h2>
        <p className="mt-2 text-supporting-scale">{addressId ? "Update the saved details for this location." : "Use an address where someone can receive your order."}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-1" noValidate>
        <div className="min-h-[92px]">
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select label="Address type" withAsterisk leftSection={<Home size={17} aria-hidden="true" />} data={["Home", "Work", "Other"]} value={field.value} onChange={field.onChange} error={errors.type?.message} disabled={isPending} allowDeselect={false} />
            )}
          />
        </div>
        <div className="min-h-[92px]"><TextInput {...register("street")} label="Street address" withAsterisk placeholder="House number, building and street" autoComplete="street-address" error={errors.street?.message} disabled={isPending} /></div>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <div className="min-h-[92px]"><TextInput {...register("city")} label="City" withAsterisk placeholder="City" autoComplete="address-level2" error={errors.city?.message} disabled={isPending} /></div>
          <div className="min-h-[92px]"><TextInput {...register("state")} label="State" withAsterisk placeholder="State" autoComplete="address-level1" error={errors.state?.message} disabled={isPending} /></div>
        </div>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <div className="min-h-[92px]"><TextInput {...register("pincode")} label="Pincode" withAsterisk placeholder="6-digit pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} error={errors.pincode?.message} disabled={isPending} /></div>
          <div className="min-h-[92px]"><TextInput {...register("phone")} label="Phone number" withAsterisk placeholder="10-digit phone number" inputMode="tel" autoComplete="tel" maxLength={10} leftSection={<Phone size={17} aria-hidden="true" />} error={errors.phone?.message} disabled={isPending} /></div>
        </div>
        <Button type="submit" fullWidth size="md" loading={isPending} loaderProps={{ type: "dots" }}>{addressId ? "Update address" : "Save address"}</Button>
      </form>
    </div>
  );
};

export default AddressForm;
