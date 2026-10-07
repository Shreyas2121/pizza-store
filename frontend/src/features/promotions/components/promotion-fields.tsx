import { NumberInput, type NumberInputProps } from "@mantine/core";

// Empty required inputs stay invalid rather than silently becoming zero.
export const IntegerField = ({
  value,
  onChange,
  ...props
}: Omit<NumberInputProps, "value" | "onChange"> & {
  value: number | null;
  onChange: (value: number) => void;
}) => (
  <NumberInput
    {...props}
    allowDecimal={false}
    clampBehavior="none"
    value={value !== null && Number.isFinite(value) ? value : ""}
    onChange={(next) => onChange(typeof next === "number" ? next : Number.NaN)}
  />
);

export const NullableIntegerField = ({
  value,
  onChange,
  ...props
}: Omit<NumberInputProps, "value" | "onChange"> & {
  value: number | null;
  onChange: (value: number | null) => void;
}) => (
  <NumberInput
    {...props}
    allowDecimal={false}
    clampBehavior="none"
    value={value !== null && Number.isFinite(value) ? value : ""}
    description={props.description ?? "Leave blank for unlimited."}
    onChange={(next) =>
      onChange(
        next === "" ? null : typeof next === "number" ? next : Number.NaN,
      )
    }
  />
);
