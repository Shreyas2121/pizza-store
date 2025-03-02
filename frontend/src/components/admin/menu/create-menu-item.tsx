import { useGetCategoriesSelect } from "@/hooks/category";
import { useGetProductByCat } from "@/hooks/products";
import { menuSchema, TMenu } from "@/lib/zodSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  MultiSelect,
  NumberInput,
  Select,
  Text,
  TextInput,
  FileInput,
  Button,
} from "@mantine/core";
import { Upload } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

const CreateMenuItem = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { data: categories } = useGetCategoriesSelect();

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const { data: products } = useGetProductByCat(selectedCategory);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TMenu>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: "",
      image: undefined,
      position: 1,
      productIds: [],
    },
  });

  const handleImageChange = (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
    return file;
  };

  const productOptions =
    products?.map((p) => ({
      value: p.id.toString(),
      label: p.name,
    })) || [];

  const onSubmit = (data: TMenu) => {
    console.log("Submitted Menu Item:", data);
    // For now, do nothing further.
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">Create Menu Item</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Product Name */}
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextInput
              label="Menu Item Name"
              placeholder="Enter menu item name"
              withAsterisk
              error={errors.name?.message}
              {...field}
            />
          )}
        />

        {/* Position */}
        <Controller
          name="position"
          control={control}
          render={({ field }) => (
            <NumberInput
              label="Position"
              placeholder="Enter position"
              withAsterisk
              error={errors.position?.message}
              value={field.value}
              onChange={(val) => field.onChange(val)}
            />
          )}
        />

        {/* Image */}
        <Controller
          name="image"
          control={control}
          render={({ field }) => (
            <>
              <FileInput
                label="Product Image"
                placeholder="Upload image"
                leftSection={<Upload size={16} />}
                withAsterisk
                accept="image/png,image/jpeg,image/gif"
                error={errors.image?.message}
                value={field.value as File | null}
                onChange={(file) => {
                  const processedFile = handleImageChange(file);
                  field.onChange(processedFile);
                }}
                description="Upload a JPEG, PNG, or GIF under 5MB"
              />

              {imagePreview && (
                <div className="mt-2">
                  <p className="text-sm mb-1">Preview:</p>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-h-40 rounded-md object-contain border border-gray-300"
                  />
                </div>
              )}
            </>
          )}
        />

        {/* Category Filter for Products */}
        <div>
          <Text className="mb-1 font-medium">Filter Products by Category</Text>
          <Select
            placeholder="Select a category"
            data={categories}
            value={selectedCategory?.toString() || ""}
            onChange={(val) => setSelectedCategory(val ? Number(val) : null)}
          />
        </div>

        {/* MultiSelect for Products */}
        <Controller
          name="productIds"
          control={control}
          render={({ field }) => (
            <MultiSelect
              label="Select Products"
              placeholder="Choose products to associate"
              data={productOptions}
              error={errors.productIds?.message}
              value={field.value.map(String)}
              onChange={(vals) => field.onChange(vals.map(Number))}
            />
          )}
        />

        <Button type="submit">Create Menu Item</Button>
      </form>
    </div>
  );
};

export default CreateMenuItem;
