import { zodResolver } from "@hookform/resolvers/zod";
import { Button, NumberInput, Switch, Textarea, TextInput } from "@mantine/core";
import { Controller, useForm } from "react-hook-form";
import { Save } from "lucide-react";
import { error, success } from "@/shared/lib";
import { useCreateStore, useUpdateStore } from "../../api/store.queries";
import { storeSchema, type StoreFormValues } from "../../model/store.schema";
import type { Store, StorePayload } from "../../model/store.types";

const defaults: StoreFormValues = {
  name: "",
  slug: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
  latitude: null,
  longitude: null,
  opensAt: "09:00",
  closesAt: "23:00",
  isActive: true,
};

export function StoreForm({ store, platformAdmin, onSaved }: { store?: Store | null; platformAdmin: boolean; onSaved: () => void }) {
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const isPending = createStore.isPending || updateStore.isPending;
  const { control, register, handleSubmit, formState: { errors } } = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: store ? {
      name: store.name,
      slug: store.slug,
      address: store.address,
      city: store.city,
      state: store.state,
      pincode: store.pincode,
      phone: store.phone,
      email: store.email ?? "",
      latitude: store.latitude,
      longitude: store.longitude,
      opensAt: store.opensAt,
      closesAt: store.closesAt,
      isActive: store.isActive,
    } : defaults,
  });

  const submit = (values: StoreFormValues) => {
    const payload: StorePayload = {
      ...values,
      slug: values.slug || undefined,
      email: values.email || null,
    };
    const onSuccess = (response: { message: string }) => {
      success(response.message || `Store ${store ? "updated" : "created"} successfully.`);
      onSaved();
    };
    const onError = () => error(`Store could not be ${store ? "updated" : "created"}.`);

    if (store) {
      const managerPayload: Partial<StorePayload> = { ...payload };
      delete managerPayload.slug;
      delete managerPayload.isActive;
      updateStore.mutate({ id: store.id, data: platformAdmin ? payload : managerPayload }, { onSuccess, onError });
      return;
    }
    createStore.mutate(payload, { onSuccess, onError });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput {...register("name")} label="Store name" placeholder="PizzaStore - Koramangala" withAsterisk error={errors.name?.message} disabled={isPending} />
        {platformAdmin && <TextInput {...register("slug")} label="Slug" placeholder="Generated from name when blank" error={errors.slug?.message} disabled={isPending} />}
        <Textarea {...register("address")} className="sm:col-span-2" label="Street address" minRows={2} withAsterisk error={errors.address?.message} disabled={isPending} />
        <TextInput {...register("city")} label="City" withAsterisk error={errors.city?.message} disabled={isPending} />
        <TextInput {...register("state")} label="State" withAsterisk error={errors.state?.message} disabled={isPending} />
        <TextInput {...register("pincode")} label="Store pincode" inputMode="numeric" maxLength={6} withAsterisk error={errors.pincode?.message} disabled={isPending} />
        <TextInput {...register("phone")} label="Phone" inputMode="tel" withAsterisk error={errors.phone?.message} disabled={isPending} />
        <TextInput {...register("email")} className="sm:col-span-2" label="Email" type="email" error={errors.email?.message} disabled={isPending} />
        <Controller name="latitude" control={control} render={({ field }) => <NumberInput label="Latitude" decimalScale={6} value={field.value ?? ""} onChange={field.onChange} error={errors.latitude?.message} disabled={isPending} />} />
        <Controller name="longitude" control={control} render={({ field }) => <NumberInput label="Longitude" decimalScale={6} value={field.value ?? ""} onChange={field.onChange} error={errors.longitude?.message} disabled={isPending} />} />
        <TextInput {...register("opensAt")} label="Opens at" type="time" withAsterisk error={errors.opensAt?.message} disabled={isPending} />
        <TextInput {...register("closesAt")} label="Closes at" type="time" withAsterisk error={errors.closesAt?.message} disabled={isPending} />
      </div>
      {platformAdmin && <Controller name="isActive" control={control} render={({ field }) => (
        <Switch label="Store is active" description="Inactive stores cannot resolve for customers." checked={field.value} onChange={(event) => field.onChange(event.currentTarget.checked)} color="basil" disabled={isPending} />
      )} />}
      <Button type="submit" fullWidth size="md" leftSection={<Save size={17} />} loading={isPending}>
        {store ? "Save changes" : "Create store"}
      </Button>
    </form>
  );
}

