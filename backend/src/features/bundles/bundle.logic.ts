import { AppError } from "../../utils/error";
import { multiplyPaiseByQuantity, subtractPaise } from "../../utils/money";
import { BUNDLE_ERROR_CODES } from "./bundle.constants";
import type {
  BundleComponentSnapshot,
  BundleDefinition,
  BundleDemandLine,
  BundleProductDto,
} from "./bundle.types";

const positiveInteger = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AppError(`${label} must be a positive integer`, 400, BUNDLE_ERROR_CODES.INVALID_DEFINITION);
  }
};

export const validateBundleDefinition = (input: {
  bundleProductId: number;
  bundleProductType: "single" | "bundle";
  components: Array<{ productId: number; productType: "single" | "bundle"; quantityPerBundle: number }>;
}) => {
  positiveInteger(input.bundleProductId, "Bundle product ID");
  if (input.bundleProductType !== "bundle" || input.components.length === 0) {
    throw new AppError("Bundle definition is invalid", 400, BUNDLE_ERROR_CODES.INVALID_DEFINITION);
  }
  const seen = new Set<number>();
  for (const component of input.components) {
    positiveInteger(component.productId, "Component product ID");
    positiveInteger(component.quantityPerBundle, "Component quantity");
    if (component.productId === input.bundleProductId || component.productType === "bundle") {
      throw new AppError("Nested bundles are not allowed", 409, BUNDLE_ERROR_CODES.NESTED);
    }
    if (seen.has(component.productId)) {
      throw new AppError("Duplicate bundle components are not allowed", 409, BUNDLE_ERROR_CODES.DUPLICATE_COMPONENT);
    }
    seen.add(component.productId);
  }
};

export const calculateBundleMarkdown = (
  sellingPricePaise: number,
  compareAtPricePaise: number,
  quantity = 1
) => {
  if (
    !Number.isSafeInteger(sellingPricePaise) ||
    sellingPricePaise < 0 ||
    !Number.isSafeInteger(compareAtPricePaise) ||
    compareAtPricePaise <= sellingPricePaise
  ) {
    throw new AppError("Bundle compare-at price must exceed its selling price", 409, BUNDLE_ERROR_CODES.PRICE_INVALID);
  }
  positiveInteger(quantity, "Bundle quantity");
  return multiplyPaiseByQuantity(
    subtractPaise(compareAtPricePaise, sellingPricePaise),
    quantity
  );
};

export const buildBundleProductDto = (input: Omit<BundleProductDto, "productType" | "markdownPaise" | "isAvailable" | "unavailableComponentIds"> & { bundleIsAvailable: boolean }) => {
  const components = [...input.components].sort((a, b) => a.productId - b.productId);
  const unavailableComponentIds = components
    .filter((component) => !component.isAvailable)
    .map((component) => component.productId);
  return {
    productId: input.productId,
    productType: "bundle" as const,
    name: input.name,
    description: input.description,
    imageUrl: input.imageUrl,
    storeId: input.storeId,
    sellingPricePaise: input.sellingPricePaise,
    compareAtPricePaise: input.compareAtPricePaise,
    markdownPaise: calculateBundleMarkdown(input.sellingPricePaise, input.compareAtPricePaise),
    isAvailable: input.bundleIsAvailable && unavailableComponentIds.length === 0,
    unavailableComponentIds,
    components,
  };
};

export const expandBundleDemand = (
  lines: ReadonlyArray<BundleDemandLine>,
  definitions: ReadonlyMap<number, BundleDefinition>
) => {
  const demand = new Map<number, number>();
  const add = (productId: number, quantity: number) => {
    positiveInteger(productId, "Product ID");
    positiveInteger(quantity, "Quantity");
    const total = (demand.get(productId) ?? 0) + quantity;
    if (!Number.isSafeInteger(total)) {
      throw new AppError("Cart quantity is too large", 400);
    }
    demand.set(productId, total);
  };

  for (const line of lines) {
    positiveInteger(line.quantity, "Quantity");
    const definition = definitions.get(line.productId);
    if (!definition) {
      add(line.productId, line.quantity);
      continue;
    }
    if (definition.components.length === 0) {
      throw new AppError("Bundle has no components", 409, BUNDLE_ERROR_CODES.INVALID_DEFINITION);
    }
    for (const component of definition.components) {
      if (!component.isAvailable) {
        throw new AppError("One or more bundle components are unavailable", 409, BUNDLE_ERROR_CODES.COMPONENT_UNAVAILABLE, {
          bundleProductId: line.productId,
          unavailableComponentIds: definition.components.filter((item) => !item.isAvailable).map((item) => item.productId).sort((a, b) => a - b),
        });
      }
      const expanded = component.quantityPerBundle * line.quantity;
      if (!Number.isSafeInteger(expanded)) {
        throw new AppError("Cart quantity is too large", 400);
      }
      add(component.productId, expanded);
    }
  }
  return new Map([...demand.entries()].sort(([a], [b]) => a - b));
};

export const createBundleComponentSnapshots = (
  definition: BundleDefinition,
  bundleQuantity: number
): BundleComponentSnapshot[] => {
  positiveInteger(bundleQuantity, "Bundle quantity");
  return [...definition.components]
    .sort((a, b) => a.productId - b.productId)
    .map((component) => ({
      productId: component.productId,
      name: component.name,
      quantityPerBundle: component.quantityPerBundle,
      totalQuantity: component.quantityPerBundle * bundleQuantity,
    }));
};
