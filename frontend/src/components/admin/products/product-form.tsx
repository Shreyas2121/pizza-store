import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, TProduct } from "@/lib/zodSchema";
import {
  TextInput,
  Textarea,
  NumberInput,
  Switch,
  Select,
  FileInput,
  Button,
} from "@mantine/core";
import { Upload, X, Check } from "lucide-react";
import { useState } from "react";
import { useGetCategoriesSelect } from "@/hooks/category";

const ProductForm = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { data: categories } = useGetCategoriesSelect();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TProduct>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      price: undefined,
      isVeg: false,
      categoryId: undefined,
      image: undefined,
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

  const onSubmit = (data: TProduct) => {
    console.log("Form submitted:", data);
  };

  return (
    <div className="max-w-3xl p-6 bg-white shadow-md rounded-lg">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextInput
                  label="Product Name"
                  placeholder="Enter product name"
                  withAsterisk
                  error={errors.name?.message}
                  {...field}
                />
              )}
            />

            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <NumberInput
                  label="Price"
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  withAsterisk
                  error={errors.price?.message}
                  value={field.value}
                  onChange={(val) => field.onChange(val)}
                />
              )}
            />

            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select
                  data={categories as any}
                  label="Category"
                  placeholder="Select a category"
                  withAsterisk
                  error={errors.categoryId?.message}
                  value={field.value?.toString()}
                  onChange={(val) => field.onChange(Number(val))}
                />
              )}
            />

            <Controller
              name="isVeg"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Vegetarian"
                  checked={field.value}
                  onChange={(event) =>
                    field.onChange(event.currentTarget.checked)
                  }
                  color="green"
                  size="md"
                  thumbIcon={
                    field.value ? (
                      <Check size={14} color="white" strokeWidth={3} />
                    ) : (
                      <X size={14} color="white" strokeWidth={3} />
                    )
                  }
                />
              )}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Textarea
                  label="Description"
                  placeholder="Enter product description"
                  autosize
                  minRows={3}
                  maxRows={5}
                  error={errors.description?.message}
                  {...field}
                />
              )}
            />

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
          </div>
        </div>

        {/* Buttons */}
        <Button mt={10} type="submit">
          Save Product
        </Button>
      </form>
    </div>
  );
};

export default ProductForm;
