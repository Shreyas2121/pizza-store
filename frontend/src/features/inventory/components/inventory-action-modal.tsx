import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, Modal, NumberInput, Text, Textarea } from "@mantine/core";
import axios from "axios";
import { Controller, useForm } from "react-hook-form";
import { Save } from "lucide-react";
import { error, success } from "@/shared/lib";
import {
  useAdjustInventory,
  useRestockInventory,
  useUpdateInventoryThreshold,
} from "../api/inventory.queries";
import {
  adjustmentSchema,
  restockSchema,
  thresholdSchema,
  type AdjustmentValues,
  type RestockValues,
  type ThresholdValues,
} from "../model/inventory.schemas";
import type {
  InventoryAction,
  InventoryMutationTarget,
} from "../model/inventory.types";

type InventoryActionModalProps = {
  action: InventoryAction | null;
  target: InventoryMutationTarget | null;
  storeId: number | null;
  onClose: () => void;
};

const mutationErrorMessage = (cause: unknown) =>
  axios.isAxiosError<{ message?: string }>(cause)
    ? cause.response?.data?.message ?? "Inventory could not be updated."
    : "Inventory could not be updated.";

const modalTitle: Record<InventoryAction, string> = {
  restock: "Restock product",
  adjust: "Adjust stock",
  threshold: "Edit low-stock threshold",
};

function RestockForm({
  storeId,
  target,
  onSaved,
}: {
  storeId: number;
  target: InventoryMutationTarget;
  onSaved: () => void;
}) {
  const mutation = useRestockInventory(storeId);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RestockValues>({
    resolver: standardSchemaResolver(restockSchema),
    defaultValues: { quantityAdded: 1, reason: "" },
  });

  const submit = (values: RestockValues) =>
    mutation.mutate(
      { productId: target.productId, values },
      {
        onSuccess: () => {
          success(`${target.productName} was restocked successfully.`);
          onSaved();
        },
        onError: (cause) => error(mutationErrorMessage(cause)),
      }
    );

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <Text size="sm" c="dimmed">
        Current on-hand quantity: {target.onHandQuantity ?? "Untracked"}
      </Text>
      <Controller
        name="quantityAdded"
        control={control}
        render={({ field }) => (
          <NumberInput
            label="Quantity to add"
            min={1}
            step={1}
            allowDecimal={false}
            withAsterisk
            value={field.value}
            onChange={field.onChange}
            error={errors.quantityAdded?.message}
            disabled={mutation.isPending}
          />
        )}
      />
      <Textarea
        {...register("reason")}
        label="Reason"
        placeholder="Optional note for this restock"
        maxLength={500}
        autosize
        minRows={2}
        error={errors.reason?.message}
        disabled={mutation.isPending}
      />
      <Button
        type="submit"
        fullWidth
        leftSection={<Save size={16} />}
        loading={mutation.isPending}
      >
        Add stock
      </Button>
    </form>
  );
}
function AdjustmentForm({
  storeId,
  target,
  onSaved,
}: {
  storeId: number;
  target: InventoryMutationTarget;
  onSaved: () => void;
}) {
  const mutation = useAdjustInventory(storeId);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdjustmentValues>({
    resolver: standardSchemaResolver(adjustmentSchema),
    defaultValues: { targetQuantity: target.onHandQuantity ?? 0, reason: "" },
  });

  const submit = (values: AdjustmentValues) =>
    mutation.mutate(
      { productId: target.productId, values },
      {
        onSuccess: () => {
          success(`${target.productName} stock was adjusted.`);
          onSaved();
        },
        onError: (cause) => error(mutationErrorMessage(cause)),
      }
    );

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <Text size="sm" c="dimmed">
        Set the absolute on-hand quantity. It cannot be lower than the currently
        reserved quantity ({target.reservedQuantity}).
      </Text>
      <Controller
        name="targetQuantity"
        control={control}
        render={({ field }) => (
          <NumberInput
            label="New on-hand quantity"
            min={0}
            step={1}
            allowDecimal={false}
            withAsterisk
            value={field.value}
            onChange={field.onChange}
            error={errors.targetQuantity?.message}
            disabled={mutation.isPending}
          />
        )}
      />
      <Textarea
        {...register("reason")}
        label="Reason"
        placeholder="Explain why the stock count changed"
        maxLength={500}
        autosize
        minRows={3}
        withAsterisk
        error={errors.reason?.message}
        disabled={mutation.isPending}
      />
      <Button
        type="submit"
        fullWidth
        leftSection={<Save size={16} />}
        loading={mutation.isPending}
      >
        Save adjustment
      </Button>
    </form>
  );
}

function ThresholdForm({
  storeId,
  target,
  onSaved,
}: {
  storeId: number;
  target: InventoryMutationTarget;
  onSaved: () => void;
}) {
  const mutation = useUpdateInventoryThreshold(storeId);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ThresholdValues>({
    resolver: standardSchemaResolver(thresholdSchema),
    defaultValues: { threshold: target.lowStockThreshold },
  });

  const submit = (values: ThresholdValues) =>
    mutation.mutate(
      { productId: target.productId, values },
      {
        onSuccess: () => {
          success(`${target.productName} threshold was updated.`);
          onSaved();
        },
        onError: (cause) => error(mutationErrorMessage(cause)),
      }
    );

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <Text size="sm" c="dimmed">
        The product is low stock when its available quantity is at or below this
        value.
      </Text>
      <Controller
        name="threshold"
        control={control}
        render={({ field }) => (
          <NumberInput
            label="Low-stock threshold"
            min={0}
            step={1}
            allowDecimal={false}
            withAsterisk
            value={field.value}
            onChange={field.onChange}
            error={errors.threshold?.message}
            disabled={mutation.isPending}
          />
        )}
      />
      <Button
        type="submit"
        fullWidth
        leftSection={<Save size={16} />}
        loading={mutation.isPending}
      >
        Save threshold
      </Button>
    </form>
  );
}

export function InventoryActionModal({
  action,
  target,
  storeId,
  onClose,
}: InventoryActionModalProps) {
  const opened = action !== null && target !== null && storeId !== null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={action ? modalTitle[action] : "Update inventory"}
      centered
      overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
    >
      {opened && action === "restock" && (
        <RestockForm storeId={storeId} target={target} onSaved={onClose} />
      )}
      {opened && action === "adjust" && (
        <AdjustmentForm storeId={storeId} target={target} onSaved={onClose} />
      )}
      {opened && action === "threshold" && (
        <ThresholdForm storeId={storeId} target={target} onSaved={onClose} />
      )}
    </Modal>
  );
}
