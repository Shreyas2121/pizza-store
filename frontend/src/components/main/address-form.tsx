import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Select, TextInput } from "@mantine/core";
import { Home, MapPin, Phone } from "lucide-react";
import { USER_API_HOOKS } from "@/hooks";
import { success } from "@/lib";

const addressSchema = z.object({
  type: z.enum(["Home", "Work", "Other"], { message: "Select an address type" }),
  street: z.string().trim().min(3, "Enter a street address"),
  city: z.string().trim().min(2, "Enter a city"),
  state: z.string().trim().min(2, "Enter a state"),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number"),
});

type AddressFormValues = z.infer<typeof addressSchema>;

const AddressForm = ({ addressId, defaultValues, onSubmit: afterSubmit }: { addressId?: number; defaultValues?: AddressFormValues; onSubmit?: () => void }) => {
  const createAddressM = USER_API_HOOKS.useCreateAddress();
  const updateAddressM = USER_API_HOOKS.useUpdateAddress();
  const isPending = createAddressM.isPending || updateAddressM.isPending;
  const { control, register, handleSubmit, formState: { errors } } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: defaultValues ?? { type: "Home", street: "", city: "", state: "", pincode: "", phone: "" },
  });

  const onSubmit = (data: AddressFormValues) => {
    const mutation = addressId ? updateAddressM : createAddressM;
    const payload = addressId ? { id: addressId, data } : data;
    mutation.mutate(payload as never, {
      onSuccess: (response: { message: string }) => {
        success(response.message);
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
