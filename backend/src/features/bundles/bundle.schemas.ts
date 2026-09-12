import { z } from "zod";
import { MONEY_CAPS } from "../../utils/money";
import {
  BUNDLE_MAX_COMPONENTS,
  BUNDLE_MAX_QUANTITY_PER_COMPONENT,
} from "./bundle.constants";

const componentSchema = z
  .object({
    productId: z.number().int().positive(),
    quantityPerBundle: z
      .number()
      .int()
      .positive()
      .max(BUNDLE_MAX_QUANTITY_PER_COMPONENT),
  })
  .strict();

const storePriceSchema = z
  .object({
    storeId: z.number().int().positive(),
    sellingPricePaise: z.number().int().nonnegative().max(MONEY_CAPS.ITEM_PRICE),
    compareAtPricePaise: z.number().int().positive().max(MONEY_CAPS.ITEM_PRICE),
    isAvailable: z.boolean().default(true),
  })
  .strict()
  .superRefine((price, context) => {
    if (price.compareAtPricePaise <= price.sellingPricePaise) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compareAtPricePaise"],
        message: "Compare-at price must be greater than selling price",
      });
    }
  });

export const bundleDefinitionWriteSchema = z
  .object({
    components: z.array(componentSchema).min(1).max(BUNDLE_MAX_COMPONENTS),
    storePrices: z.array(storePriceSchema).min(1).max(250),
  })
  .strict()
  .superRefine((definition, context) => {
    const componentIds = definition.components.map((item) => item.productId);
    if (new Set(componentIds).size !== componentIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["components"],
        message: "Bundle component products must be unique",
      });
    }
    const storeIds = definition.storePrices.map((item) => item.storeId);
    if (new Set(storeIds).size !== storeIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storePrices"],
        message: "Bundle store prices must be unique per store",
      });
    }
  });

export type BundleDefinitionWrite = z.infer<typeof bundleDefinitionWriteSchema>;
