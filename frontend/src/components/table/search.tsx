import { Input } from "@mantine/core";
import { Search } from "lucide-react";
import React from "react";

interface Props {
  value: string;
  placeholder: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const SearchField = ({ placeholder, value, onChange }: Props) => {
  return (
    <div className="flex gap-3 items-center">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-[2rem]"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default SearchField;
