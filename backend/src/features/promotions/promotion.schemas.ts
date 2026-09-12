import { z } from "zod";
import { MAX_POSTGRES_INT, MONEY_CAPS } from "../../utils/money";
import {
  BASIS_POINTS_SCALE,
  PROMOTION_CODE_MAX_LENGTH,
  PROMOTION_DESCRIPTION_MAX_LENGTH,
  PROMOTION_DERIVED_STATUSES,
  PROMOTION_IMAGE_ALT_MAX_LENGTH,
  PROMOTION_KINDS,
  PROMOTION_LIST_DEFAULT_PAGE_SIZE,
  PROMOTION_LIST_MAX_PAGE_SIZE,
  PROMOTION_MAX_EXPANDED_UNITS,
  PROMOTION_MEDIA_VARIANTS,
  PROMOTION_NAME_MAX_LENGTH,
  PROMOTION_SCOPES,
  STORE_PROMOTION_REASON_MAX_LENGTH,
  WEEKDAYS,
} from "./promotion.constants";

const positiveIdSchema = z.number().int().positive();
const positivePaiseSchema = z.number().int().positive().max(MAX_POSTGRES_INT);
const nonNegativeOrderPaiseSchema = z
  .number()
  .int()
  .min(0)
  .max(MONEY_CAPS.ORDER_AMOUNT);
const positiveDiscountPaiseSchema = z
  .number()
  .int()
  .positive()
  .max(MONEY_CAPS.DISCOUNT);
const nullablePositiveIntegerSchema = z.number().int().positive().nullable();
const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const weekdaySchema = z.union(WEEKDAYS.map((day) => z.literal(day)));

const uniquePositiveIdsSchema = z
  .array(positiveIdSchema)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", message: "Target IDs must be unique" });
    }
  });

export const percentageDiscountSchema = z
  .object({
    type: z.literal("percentage"),
    rateBps: z.number().int().min(1).max(BASIS_POINTS_SCALE),
    maxDiscountPaise: positiveDiscountPaiseSchema.nullable(),
  })
  .strict();

export const fixedAmountDiscountSchema = z
  .object({
    type: z.literal("fixed_amount"),
    amountPaise: positiveDiscountPaiseSchema,
  })
  .strict();

export const promotionDiscountSchema = z.discriminatedUnion("type", [
  percentageDiscountSchema,
  fixedAmountDiscountSchema,
  z.object({ type: z.literal("buy_x_get_y") }).strict(),
  z.object({ type: z.literal("free_delivery") }).strict(),
  z.object({ type: z.literal("tiered") }).strict(),
]);

const productIncludeRuleSchema = z
  .object({
    type: z.literal("product_include"),
    productId: positiveIdSchema,
  })
  .strict();

const categoryIncludeRuleSchema = z
  .object({
    type: z.literal("category_include"),
    categoryId: positiveIdSchema,
  })
  .strict();

export const buyXGetYRuleSchema = z
  .object({
    type: z.literal("buy_x_get_y"),
    buyQuantity: z.number().int().positive(),
    getQuantity: z.number().int().positive(),
    buyProductIds: uniquePositiveIdsSchema,
    buyCategoryIds: uniquePositiveIdsSchema,
    getProductIds: uniquePositiveIdsSchema,
    getCategoryIds: uniquePositiveIdsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.buyProductIds.length + value.buyCategoryIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["buyProductIds"],
        message: "A BXGY rule requires at least one buy target",
      });
    }
    if (value.getProductIds.length + value.getCategoryIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["getProductIds"],
        message: "A BXGY rule requires at least one get target",
      });
    }
  });

const tierRuleSchema = z
  .object({
    type: z.literal("tier"),
    minimumSubtotalPaise: nonNegativeOrderPaiseSchema,
    discount: z.discriminatedUnion("type", [
      percentageDiscountSchema,
      fixedAmountDiscountSchema,
    ]),
  })
  .strict();

export const promotionRuleSchema = z.union([
  productIncludeRuleSchema,
  categoryIncludeRuleSchema,
  buyXGetYRuleSchema,
  tierRuleSchema,
]);

const definitionWriteObject = z
  .object({
    kind: z.enum(PROMOTION_KINDS),
    name: z.string().trim().min(1).max(PROMOTION_NAME_MAX_LENGTH),
    description: z
      .string()
      .trim()
      .min(1)
      .max(PROMOTION_DESCRIPTION_MAX_LENGTH),
    code: z
      .string()
      .trim()
      .min(1)
      .max(PROMOTION_CODE_MAX_LENGTH)
      .transform((value) => value.toUpperCase())
      .nullable(),
    discount: promotionDiscountSchema,
    scope: z.enum(PROMOTION_SCOPES),
    includeCustomizationValue: z.boolean().default(false),
    eligibility: z
      .object({
        minimumOrderPaise: nonNegativeOrderPaiseSchema,
        minimumCartQuantity: z
          .number()
          .int()
          .min(0)
          .max(PROMOTION_MAX_EXPANDED_UNITS),
        firstOrderOnly: z.boolean(),
      })
      .strict(),
    validity: z
      .object({
        startsAt: z.iso.datetime(),
        endsAt: z.iso.datetime(),
        activeDaysOfWeek: z
          .array(weekdaySchema)
          .min(1)
          .max(WEEKDAYS.length)
          .superRefine((values, context) => {
            if (new Set(values).size !== values.length) {
              context.addIssue({
                code: "custom",
                message: "Active weekdays must be unique",
              });
            }
          })
          .nullable(),
        activeStartTime: localTimeSchema.nullable(),
        activeEndTime: localTimeSchema.nullable(),
      })
      .strict(),
    limits: z
      .object({
        perUserRedemptions: nullablePositiveIntegerSchema,
        globalRedemptions: nullablePositiveIntegerSchema,
        budgetPaise: positivePaiseSchema.nullable(),
      })
      .strict(),
    display: z
      .object({
        priority: z.number().int().min(0),
        showOnHomepage: z.boolean(),
      })
      .strict(),
    rules: z.array(promotionRuleSchema),
    isActive: z.boolean(),
  })
  .strict();

type DefinitionWriteValue = z.infer<typeof definitionWriteObject>;

const validateDefinition = (
  value: DefinitionWriteValue,
  context: z.RefinementCtx
) => {
  if (value.kind === "coupon" && value.code === null) {
    context.addIssue({
      code: "custom",
      path: ["code"],
      message: "Coupons require a code",
    });
  }
  if (value.kind === "offer" && value.code !== null) {
    context.addIssue({
      code: "custom",
      path: ["code"],
      message: "Offers cannot have a code",
    });
  }

  const { type } = value.discount;
  const combinationIsValid =
    (value.kind === "coupon" &&
      value.scope === "cart" &&
      ["percentage", "fixed_amount", "tiered"].includes(type)) ||
    (value.kind === "offer" &&
      ((["percentage", "fixed_amount"].includes(type) &&
        ["cart", "product", "category"].includes(value.scope)) ||
        (type === "buy_x_get_y" &&
          ["product", "category"].includes(value.scope)) ||
        (type === "free_delivery" && value.scope === "delivery") ||
        (type === "tiered" && value.scope === "cart")));
  if (!combinationIsValid) {
    context.addIssue({
      code: "custom",
      path: ["scope"],
      message: "Promotion kind, discount type, and scope are incompatible",
    });
  }

  if (
    value.includeCustomizationValue &&
    !["percentage", "fixed_amount", "tiered"].includes(type)
  ) {
    context.addIssue({
      code: "custom",
      path: ["includeCustomizationValue"],
      message: "This discount type cannot include customization value",
    });
  }

  const startsAt = Date.parse(value.validity.startsAt);
  const endsAt = Date.parse(value.validity.endsAt);
  if (endsAt <= startsAt) {
    context.addIssue({
      code: "custom",
      path: ["validity", "endsAt"],
      message: "endsAt must be later than startsAt",
    });
  }
  const hasStartTime = value.validity.activeStartTime !== null;
  const hasEndTime = value.validity.activeEndTime !== null;
  if (hasStartTime !== hasEndTime) {
    context.addIssue({
      code: "custom",
      path: ["validity", "activeEndTime"],
      message: "Active start and end times must both be set or both be null",
    });
  } else if (
    hasStartTime &&
    value.validity.activeStartTime === value.validity.activeEndTime
  ) {
    context.addIssue({
      code: "custom",
      path: ["validity", "activeEndTime"],
      message: "Active start and end times cannot be equal",
    });
  }

  const productRules = value.rules.filter(
    (rule) => rule.type === "product_include"
  );
  const categoryRules = value.rules.filter(
    (rule) => rule.type === "category_include"
  );
  const bxgyRules = value.rules.filter((rule) => rule.type === "buy_x_get_y");
  const tierRules = value.rules.filter((rule) => rule.type === "tier");

  const validRuleShape =
    ((type === "percentage" || type === "fixed_amount") &&
      ((value.scope === "cart" && value.rules.length === 0) ||
        (value.scope === "product" &&
          productRules.length === value.rules.length &&
          productRules.length > 0) ||
        (value.scope === "category" &&
          categoryRules.length === value.rules.length &&
          categoryRules.length > 0))) ||
    (type === "buy_x_get_y" &&
      bxgyRules.length === 1 &&
      value.rules.length === 1) ||
    (type === "tiered" &&
      tierRules.length === value.rules.length &&
      tierRules.length > 0) ||
    (type === "free_delivery" && value.rules.length === 0);

  if (!validRuleShape) {
    context.addIssue({
      code: "custom",
      path: ["rules"],
      message: "Rules do not match the promotion discount type and scope",
    });
  }

  const targetKeys = value.rules.flatMap((rule) => {
    if (rule.type === "product_include") return [`product:${rule.productId}`];
    if (rule.type === "category_include") return [`category:${rule.categoryId}`];
    return [];
  });
  if (new Set(targetKeys).size !== targetKeys.length) {
    context.addIssue({
      code: "custom",
      path: ["rules"],
      message: "Promotion include targets must be unique",
    });
  }

  const tierThresholds = tierRules.map((rule) => rule.minimumSubtotalPaise);
  if (new Set(tierThresholds).size !== tierThresholds.length) {
    context.addIssue({
      code: "custom",
      path: ["rules"],
      message: "Tier thresholds must be unique",
    });
  }

  if (value.display.showOnHomepage && value.kind !== "offer") {
    context.addIssue({
      code: "custom",
      path: ["display", "showOnHomepage"],
      message: "Only offers can be placed on the homepage",
    });
  }
};

export const promotionDefinitionWriteSchema =
  definitionWriteObject.superRefine(validateDefinition);

export const promotionUpdateRequestSchema = definitionWriteObject
  .extend({ expectedDefinitionVersion: z.number().int().positive() })
  .superRefine(validateDefinition);

export const storePromotionSettingWriteSchema = z
  .object({
    enabled: z.boolean(),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(STORE_PROMOTION_REASON_MAX_LENGTH)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.enabled && value.reason === undefined) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A reason is required when disabling a promotion",
      });
    }
  });

export const promotionListQuerySchema = z
  .object({
    kind: z.enum(PROMOTION_KINDS).optional(),
    status: z.enum(PROMOTION_DERIVED_STATUSES).optional(),
    storeId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(PROMOTION_LIST_MAX_PAGE_SIZE)
      .default(PROMOTION_LIST_DEFAULT_PAGE_SIZE),
  })
  .strict();

export const promotionMediaMetadataSchema = z
  .object({
    variant: z.enum(PROMOTION_MEDIA_VARIANTS),
    imageAlt: z.string().trim().min(1).max(PROMOTION_IMAGE_ALT_MAX_LENGTH),
  })
  .strict();

export const promotionItemInputSchema = z
  .object({
    lineId: positiveIdSchema,
    productId: positiveIdSchema,
    categoryId: positiveIdSchema,
    productType: z.enum(["single", "bundle"]),
    quantity: z.number().int().positive().max(PROMOTION_MAX_EXPANDED_UNITS),
    baseUnitPricePaise: z
      .number()
      .int()
      .min(0)
      .max(MONEY_CAPS.ITEM_PRICE),
    customizationUnitPricePaise: z
      .number()
      .int()
      .min(0)
      .max(MONEY_CAPS.CUSTOMIZATION_PRICE),
  })
  .strict();

export type PromotionDefinitionWriteInput = z.infer<
  typeof promotionDefinitionWriteSchema
>;
export type PromotionUpdateRequestInput = z.infer<
  typeof promotionUpdateRequestSchema
>;
export type StorePromotionSettingWriteInput = z.infer<
  typeof storePromotionSettingWriteSchema
>;
