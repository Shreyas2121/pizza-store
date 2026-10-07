import { AppError } from "../../utils/error";

type SelectionGroup = {
  name: string;
  type: "single" | "multiple";
  required: boolean;
  options: Array<{ id: number; isAvailable: boolean }>;
};

export function validateCustomizationSelection(groups: SelectionGroup[], ids: number[]) {
  if (new Set(ids).size !== ids.length) throw new AppError("Customization options must be unique", 400);
  const availableIds = new Set(groups.flatMap((group) => group.options.filter((option) => option.isAvailable).map((option) => option.id)));
  if (ids.some((id) => !availableIds.has(id))) throw new AppError("Invalid or unavailable customization option for this product", 400);
  for (const group of groups) {
    const count = group.options.filter((option) => ids.includes(option.id)).length;
    if (group.required && count === 0) throw new AppError(`Choose an option from ${group.name}`, 400);
    if (group.type === "single" && count > 1) throw new AppError(`Choose only one option from ${group.name}`, 400);
  }
}
