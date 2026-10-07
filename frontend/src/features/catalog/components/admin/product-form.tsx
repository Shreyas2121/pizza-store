import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextInput, Textarea, NumberInput, Switch, Select, FileInput, Button, Loader, Paper, Text } from "@mantine/core";
import { ImagePlus, Save, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useGetCategoriesSelect } from "../../api/category.queries";
import { useCreateProduct } from "../../api/product.queries";
import { productSchema, TProduct } from "../../model/catalog.schemas";
import { APP_CURRENCY_SYMBOL, parseRupeesToPaise, success } from "@/shared/lib";

export const ProductForm = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError } = useGetCategoriesSelect();
  const createProduct = useCreateProduct();
  const navigate = useNavigate();
  const { control, handleSubmit, formState: { errors } } = useForm<TProduct>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", price: undefined, isVeg: false, productType: "single", categoryId: undefined, image: undefined },
  });

  const handleImageChange = (file: File | null) => {
    setImagePreview(file ? URL.createObjectURL(file) : null);
    return file;
  };

  const onSubmit = (data: TProduct) => {
    const payload = new FormData();
    payload.append("name", data.name.trim());
    payload.append("description", data.description ?? "");
    payload.append("pricePaise", String(parseRupeesToPaise(data.price)));
    payload.append("categoryId", String(data.categoryId));
    payload.append("veg", String(data.isVeg));
    payload.append("productType", data.productType);
    payload.append("image", data.image);
    createProduct.mutate(payload, {
      onSuccess: (response) => {
        success("Product created successfully.");
        navigate(data.productType === "bundle" ? `/admin/bundles/${response.data.id}` : "/admin/products");
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pb-24">
      <Paper withBorder radius="lg" p="lg">
        <Text fw={700} size="lg">Product details</Text>
        <Text size="sm" c="dimmed" mb="lg">The name, category, and description customers see in the catalogue.</Text>
        <div className="grid gap-5 md:grid-cols-2">
          <Controller name="productType" control={control} render={({ field }) => (
            <Select label="Product type" description="Bundles combine existing products. Configure contents and store prices after saving." data={[{ value: "single", label: "Single product" }, { value: "bundle", label: "Bundle / combo" }]} allowDeselect={false} {...field} error={errors.productType?.message} />
          )} />
          <Controller name="name" control={control} render={({ field }) => (
            <TextInput label="Product name" placeholder="e.g. Margherita pizza" withAsterisk error={errors.name?.message} {...field} />
          )} />
          <Controller name="categoryId" control={control} render={({ field }) => (
            <Select searchable data={categories ?? []} label="Category" placeholder={categoriesLoading ? "Loading categories…" : "Choose a category"} withAsterisk disabled={categoriesLoading || createProduct.isPending} rightSection={categoriesLoading ? <Loader size={16} /> : undefined} error={errors.categoryId?.message ?? (categoriesError ? "Categories could not be loaded" : undefined)} value={field.value?.toString() ?? null} onChange={(value) => field.onChange(value ? Number(value) : undefined)} />
          )} />
          <Controller name="description" control={control} render={({ field }) => (
            <Textarea className="md:col-span-2" label="Description" placeholder="Describe the flavour, ingredients, and portion." autosize minRows={4} error={errors.description?.message} {...field} />
          )} />
        </div>
      </Paper>

      <Paper withBorder radius="lg" p="lg">
        <Text fw={700} size="lg">Pricing and dietary information</Text>
        <Text size="sm" c="dimmed" mb="lg">Set the base price and the dietary mark shown to customers.</Text>
        <div className="grid gap-5 md:grid-cols-2 md:items-end">
          <Controller name="price" control={control} render={({ field }) => (
            <NumberInput label="Base price" prefix={`${APP_CURRENCY_SYMBOL} `} min={1} decimalScale={2} withAsterisk error={errors.price?.message} value={field.value} onChange={field.onChange} />
          )} />
          <Controller name="isVeg" control={control} render={({ field }) => (
            <Switch label="Vegetarian product" description="Shows the green vegetarian mark in the menu." checked={field.value} onChange={(event) => field.onChange(event.currentTarget.checked)} color="basil" />
          )} />
        </div>
      </Paper>

      <Paper withBorder radius="lg" p="lg">
        <Text fw={700} size="lg">Product image</Text>
        <Text size="sm" c="dimmed" mb="lg">Use a bright landscape image. JPEG or PNG, up to 5 MB; 4:3 works best.</Text>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <Controller name="image" control={control} render={({ field }) => (
            <FileInput label="Upload image" placeholder="Choose an image" leftSection={<ImagePlus size={16} />} withAsterisk accept="image/png,image/jpeg,image/gif" error={errors.image?.message} value={field.value as File | null} onChange={(file) => field.onChange(handleImageChange(file))} clearable />
          )} />
          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-dashed border-border bg-surface-muted">
            {imagePreview ? <img src={imagePreview} alt="New product preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-ink-muted">Image preview</div>}
          </div>
        </div>
      </Paper>

      <div className="sticky bottom-0 z-20 -mx-1 border-t border-border bg-surface/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl justify-end gap-3">
          <Button component={Link} to="/admin/products" variant="default" leftSection={<X size={16} />}>Cancel</Button>
          <Button type="submit" color="brand" loading={createProduct.isPending} leftSection={<Save size={16} />}>Save product</Button>
        </div>
      </div>
    </form>
  );
};

export default ProductForm;
