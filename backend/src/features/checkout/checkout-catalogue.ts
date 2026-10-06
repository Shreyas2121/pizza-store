import { AppError } from "../../utils/error";
import { multiplyPaiseByQuantity } from "../../utils/money";
import type { TransactionType } from "../../utils/types";
import type { PricingItemInput as PromotionPricingItemInput } from "../pricing";
import { publicQuoteRepository } from "./checkout.repository";
export interface RequestedCheckoutItem {
  lineId: number;
  productId: number;
  quantity: number;
  customizationOptionIds?: number[];
}
export async function loadCheckoutPricingItems(
  storeId: number,
  requestedItems: RequestedCheckoutItem[],
  executor?: TransactionType,
) {
  const productIds = [...new Set(requestedItems.map((item) => item.productId))];
  const storeProducts = await publicQuoteRepository.findStoreProducts(
    storeId,
    productIds,
    ...(executor ? [executor] : []),
  );
  const productMap = new Map(
    storeProducts.map((product) => [product.productId, product]),
  );
  const allOptionIds = [
    ...new Set(
      requestedItems.flatMap((item) => item.customizationOptionIds ?? []),
    ),
  ];
  const options = allOptionIds.length
    ? await publicQuoteRepository.findProductCustomizationOptions(
        productIds,
        allOptionIds,
        ...(executor ? [executor] : []),
      )
    : [];
  const optionMap = new Map(
    options.map((option) => [
      String(option.productId) + ":" + option.optionId,
      option,
    ]),
  );
  const bundleIds = storeProducts
    .filter((product) => product.productType === "bundle")
    .map((product) => product.productId);
  const bundles = await publicQuoteRepository.findBundleDefinitions(
    storeId,
    bundleIds,
    ...(executor ? [executor] : []),
  );
  const pricingItems: PromotionPricingItemInput[] = requestedItems.map(
    (item) => {
      const product = productMap.get(item.productId);
      if (
        !product ||
        !product.productIsAvailable ||
        !product.storeProductIsAvailable
      )
        throw new AppError(
          "Product is unavailable at the selected store",
          409,
          "STORE_PRODUCT_UNAVAILABLE",
        );
      const optionIds = item.customizationOptionIds ?? [];
      if (new Set(optionIds).size !== optionIds.length)
        throw new AppError(
          "Duplicate customization options",
          409,
          "PRODUCT_CUSTOMIZATION_UNAVAILABLE",
        );
      const customizations = optionIds.map((optionId) => {
        const option = optionMap.get(String(item.productId) + ":" + optionId);
        if (!option || !option.isAvailable)
          throw new AppError(
            "Customization is unavailable for this product",
            409,
            "PRODUCT_CUSTOMIZATION_UNAVAILABLE",
          );
        return {
          customizationOptionId: option.optionId,
          name: option.optionName,
          pricePaise: option.pricePaise,
        };
      });
      const definition = bundles.get(product.productId);
      if (
        product.productType === "bundle" &&
        (!definition ||
          customizations.length ||
          !definition.components.length ||
          definition.components.some((component) => !component.isAvailable))
      )
        throw new AppError(
          "Bundle is unavailable or cannot be customized",
          409,
          "BUNDLE_DEFINITION_INVALID",
        );
      return {
        lineId: item.lineId,
        productId: product.productId,
        categoryId: product.categoryId,
        productName: product.productName,
        quantity: item.quantity,
        baseUnitPricePaise: product.pricePaise,
        customizations,
        productType: product.productType,
        compareAtUnitPricePaise: product.compareAtUnitPricePaise,
        bundleComponents:
          definition?.components.map((component) => ({
            ...component,
            totalQuantity: multiplyPaiseByQuantity(
              component.quantityPerBundle,
              item.quantity,
            ),
          })) ?? [],
      };
    },
  );

  return pricingItems;
}
