import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, Modal, NumberInput, Text, Textarea } from "@mantine/core";
import axios from "axios";
import { PackagePlus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { error, success } from "@/shared/lib";
import { useBulkRestockInventory } from "../api/inventory.queries";
import {
  bulkRestockSchema,
  type BulkRestockValues,
} from "../model/inventory.schemas";
import type { InventoryItem } from "../model/inventory.types";

type BulkRestockModalProps = {
  storeId: number;
  selectedItems: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
};

export function BulkRestockModal({
  storeId,
  selectedItems,
  onClose,
  onSaved,
}: BulkRestockModalProps) {
  const mutation = useBulkRestockInventory(storeId);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BulkRestockValues>({
    resolver: standardSchemaResolver(bulkRestockSchema),
    defaultValues: {
      items: selectedItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantityAdded: 1,
        reason: "",
      })),
    },
  });
  const { fields, remove } = useFieldArray({ control, name: "items" });

  const submit = (values: BulkRestockValues) =>
    mutation.mutate(values, {
      onSuccess: () => {
        success(
          `${values.items.length} ${values.items.length === 1 ? "product was" : "products were"} restocked.`
        );
        onSaved();
      },
      onError: (cause) => {
        const message = axios.isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message
          : null;
        error(message ?? "Bulk restock could not be completed.");
      },
    });

  return (
    <Modal
      opened
      onClose={onClose}
      title="Bulk restock"
      size="xl"
      centered
      overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Text size="sm" c="dimmed" mb="md">
          Add stock to up to 50 products in one atomic operation. If any product
          is invalid, none of the changes are saved.
        </Text>

        <div className="max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-xl border border-border bg-surface-muted p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-semibold text-ink">{field.productName}</p>
                <Button
                  type="button"
                  variant="subtle"
                  color="red"
                  size="compact-sm"
                  leftSection={<Trash2 size={14} />}
                  onClick={() => remove(index)}
                  disabled={mutation.isPending}
                >
                  Remove
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                <Controller
                  name={`items.${index}.quantityAdded`}
                  control={control}
                  render={({ field: quantityField }) => (
                    <NumberInput
                      label="Quantity to add"
                      min={1}
                      step={1}
                      allowDecimal={false}
                      withAsterisk
                      value={quantityField.value}
                      onChange={quantityField.onChange}
                      error={errors.items?.[index]?.quantityAdded?.message}
                      disabled={mutation.isPending}
                    />
                  )}
                />
                <Controller
                  name={`items.${index}.reason`}
                  control={control}
                  render={({ field: reasonField }) => (
                    <Textarea
                      {...reasonField}
                      label="Reason"
                      placeholder="Optional note"
                      maxLength={500}
                      autosize
                      minRows={1}
                      error={errors.items?.[index]?.reason?.message}
                      disabled={mutation.isPending}
                    />
                  )}
                />
              </div>
            </div>
          ))}
        </div>

        {errors.items?.root?.message && (
          <Text c="red" size="sm" mt="sm">
            {errors.items.root.message}
          </Text>
        )}

        <div className="mt-5 flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="default" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            leftSection={<PackagePlus size={16} />}
            loading={mutation.isPending}
            disabled={fields.length === 0}
          >
            Restock {fields.length || "selected"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
