import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FileInput, Loader, MultiSelect, NumberInput, Paper, Select, Text, TextInput } from "@mantine/core";
import { ImagePlus, Save } from "lucide-react";
import { useGetCategoriesSelect } from "../../api/category.queries";
import { useGetProductByCat } from "../../api/product.queries";
import { useCreateMenuItem, useCreateMenuMapping } from "../../api/menu.queries";
import { menuSchema, TMenu } from "../../model/catalog.schemas";
import { useAuthModalStore } from "@/shared/model";
import { success } from "@/shared/lib";

export const MenuForm = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError } = useGetCategoriesSelect();
  const { data: products, isLoading: productsLoading, isError: productsError } = useGetProductByCat(selectedCategory);
  const createMenu = useCreateMenuItem();
  const createMapping = useCreateMenuMapping();
  const closeModal = useAuthModalStore((state) => state.closeModal);
  const { control, handleSubmit, formState: { errors } } = useForm<TMenu>({
    resolver: zodResolver(menuSchema),
    defaultValues: { name: "", image: undefined, position: 1, productIds: [] },
  });

  const productOptions = products?.map((product) => ({ value: String(product.id), label: product.name })) ?? [];
  const isSaving = createMenu.isPending || createMapping.isPending;

  const onSubmit = (data: TMenu) => {
    const payload = new FormData();
    payload.append("name", data.name.trim());
    payload.append("position", String(data.position));
    payload.append("image", data.image);
    createMenu.mutate(payload as never, {
      onSuccess: (response: { data: { id: number } }) => {
        createMapping.mutate({ menuItemId: response.data.id, productIds: data.productIds } as never, {
          onSuccess: () => {
            success("Menu section created and products assigned.");
            closeModal();
          },
        });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Paper withBorder radius="lg" p="md">
        <Text fw={700}>Section details</Text>
        <Text size="sm" c="dimmed" mb="md">Controls the section label, order, and image in menu discovery.</Text>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller name="name" control={control} render={({ field }) => <TextInput label="Section name" placeholder="e.g. Pizzas" withAsterisk error={errors.name?.message} {...field} />} />
          <Controller name="position" control={control} render={({ field }) => <NumberInput label="Display position" min={1} withAsterisk error={errors.position?.message} value={field.value} onChange={field.onChange} />} />
        </div>
      </Paper>

      <Paper withBorder radius="lg" p="md">
        <Text fw={700}>Section image</Text>
        <Text size="sm" c="dimmed" mb="md">Use a square or landscape food image, up to 5 MB.</Text>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Controller name="image" control={control} render={({ field }) => <FileInput label="Upload image" placeholder="Choose an image" leftSection={<ImagePlus size={16} />} accept="image/png,image/jpeg,image/gif" withAsterisk error={errors.image?.message} value={field.value as File | null} onChange={(file) => { field.onChange(file); setImagePreview(file ? URL.createObjectURL(file) : null); }} />} />
          <div className="aspect-square overflow-hidden rounded-xl border border-dashed border-border bg-surface-muted">
            {imagePreview ? <img src={imagePreview} alt="Menu section preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-ink-muted">Preview</div>}
          </div>
        </div>
      </Paper>

      <Paper withBorder radius="lg" p="md">
        <Text fw={700}>Assign products</Text>
        <Text size="sm" c="dimmed" mb="md">Choose a category first, then select the products this section should contain.</Text>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Product category" placeholder={categoriesLoading ? "Loading categories…" : "Choose category"} searchable clearable disabled={categoriesLoading || isSaving} rightSection={categoriesLoading ? <Loader size={16} /> : undefined} error={categoriesError ? "Categories could not be loaded" : undefined} data={categories ?? []} value={selectedCategory?.toString() ?? null} onChange={(value) => setSelectedCategory(value ? Number(value) : null)} />
          <Controller name="productIds" control={control} render={({ field }) => <MultiSelect label="Products" placeholder={productsLoading ? "Loading products…" : selectedCategory ? "Select products" : "Choose a category first"} disabled={!selectedCategory || productsLoading || isSaving} rightSection={productsLoading ? <Loader size={16} /> : undefined} searchable data={productOptions} error={errors.productIds?.message ?? (productsError ? "Products could not be loaded" : undefined)} value={field.value.map(String)} onChange={(values) => field.onChange(values.map(Number))} />} />
        </div>
      </Paper>

      <div className="sticky -bottom-4 -mx-4 flex justify-end gap-3 border-t border-border bg-surface/95 p-4 backdrop-blur">
        <Button type="button" variant="default" onClick={closeModal}>Cancel</Button>
        <Button type="submit" color="brand" loading={isSaving} leftSection={<Save size={16} />}>Create section</Button>
      </div>
    </form>
  );
};

export default MenuForm;
