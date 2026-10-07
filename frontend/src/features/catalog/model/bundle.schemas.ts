import { z } from "zod";

export const bundleWriteSchema = z.object({
  components: z.array(z.object({ productId: z.number().int().positive(), quantityPerBundle: z.number().int().min(1).max(100) })).min(1).max(50),
  storePrices: z.array(z.object({
    storeId: z.number().int().positive(),
    sellingPricePaise: z.number().int().min(0).max(100_000),
    compareAtPricePaise: z.number().int().min(1).max(100_000),
    isAvailable: z.boolean(),
  }).refine((price) => price.compareAtPricePaise > price.sellingPricePaise, "Regular price must exceed the selling price.")).min(1).max(250),
}).superRefine((value, context) => {
  if (new Set(value.components.map((item) => item.productId)).size !== value.components.length) context.addIssue({ code: "custom", message: "Choose each component product only once.", path: ["components"] });
  if (new Set(value.storePrices.map((item) => item.storeId)).size !== value.storePrices.length) context.addIssue({ code: "custom", message: "Choose each store only once.", path: ["storePrices"] });
});
export type BundleWrite = z.infer<typeof bundleWriteSchema>;
