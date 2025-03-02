import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input, Button, Select, Text } from "@mantine/core";
import { useCreateAddress } from "../../hooks/user";
import { success } from "../../lib/utils";

// Zod Schema for validation
const addressSchema = z.object({
  type: z.enum(["Home", "Work", "Other"], { message: "Select a type" }),
  street: z.string().min(3, "Street is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number"),
});

// Address form type
type AddressFormValues = z.infer<typeof addressSchema>;

const AddressForm = ({
  defaultValues,
  onSubmit: submit,
}: {
  defaultValues?: AddressFormValues;
  onSubmit?: () => void;
}) => {
  const createAddressM = useCreateAddress();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: defaultValues || {},
  });

  const onSubmit = (data: AddressFormValues) => {
    // Handle form submission
    createAddressM.mutate(data, {
      onSuccess: (res) => {
        success(res.message);
        if (submit) {
          submit();
        }
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 bg-white p-6 rounded-lg shadow-md"
    >
      {/* Address Type */}
      <div>
        <Text className="font-medium">Address Type</Text>
        <Select
          placeholder="Select Address Type"
          data={["Home", "Work", "Other"]}
          onChange={(value: any) => setValue("type", value)}
          error={errors.type?.message}
        />
      </div>

      {/* Street */}
      <div>
        <Text className="font-medium">Street</Text>
        <Input {...register("street")} placeholder="Street Address" />
        {errors.street && (
          <Text className="text-red-500 text-sm">{errors.street.message}</Text>
        )}
      </div>

      {/* City & State */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Text className="font-medium">City</Text>
          <Input {...register("city")} placeholder="City" />
          {errors.city && (
            <Text className="text-red-500 text-sm">{errors.city.message}</Text>
          )}
        </div>

        <div>
          <Text className="font-medium">State</Text>
          <Input {...register("state")} placeholder="State" />
          {errors.state && (
            <Text className="text-red-500 text-sm">{errors.state.message}</Text>
          )}
        </div>
      </div>

      {/* Pincode & Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Text className="font-medium">Pincode</Text>
          <Input {...register("pincode")} placeholder="Pincode" />
          {errors.pincode && (
            <Text className="text-red-500 text-sm">
              {errors.pincode.message}
            </Text>
          )}
        </div>

        <div>
          <Text className="font-medium">Phone</Text>
          <Input {...register("phone")} placeholder="Phone Number" />
          {errors.phone && (
            <Text className="text-red-500 text-sm">{errors.phone.message}</Text>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <Button type="submit" fullWidth color="red">
        Save Address
      </Button>
    </form>
  );
};

export default AddressForm;
