import { ActionIcon, TextInput } from "@mantine/core";
import { Search, X } from "lucide-react";
import React from "react";

interface Props {
  value: string;
  placeholder: string;
  label?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DataTableSearch = ({ placeholder, value, onChange, label = "Search" }: Props) => (
  <TextInput
    label={label}
    leftSection={<Search aria-hidden="true" size={16} />}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    rightSection={value ? (
      <ActionIcon
        variant="subtle"
        color="gray"
        size={32}
        aria-label={`Clear ${label.toLowerCase()}`}
        onClick={() => onChange({ target: { value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>)}
      >
        <X size={15} />
      </ActionIcon>
    ) : undefined}
    className="w-full sm:max-w-sm"
  />
);

export default DataTableSearch;
