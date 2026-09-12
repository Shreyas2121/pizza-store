import {
  addPaise,
  allocateProportional,
  assertNonNegativePaise,
  calculateBasisPoints,
  MAX_POSTGRES_INT,
  MONEY_CAPS,
  multiplyPaiseByQuantity,
} from "../../utils/money";
import {
  BASIS_POINTS_SCALE,
  COUPON_CONFLICT_REASONS,
  PROMOTION_ERROR_CODES,
  PROMOTION_INELIGIBILITY_REASONS,
  PROMOTION_MAX_EXPANDED_UNITS,
  WEEKDAY_BY_SHORT_NAME,
} from "./promotion.constants";
import type {
  CouponEligibility,
  FailedPromotionResolution,
  PromotionAllocation,
  PromotionCandidate,
  PromotionEvaluationContext,
  PromotionIneligibilityReasonCode,
  PromotionItemAllocation,
  PromotionItemInput,
  PromotionRecord,
  PromotionResolution,
  PromotionResolutionContext,
  PromotionRule,
  ResolvedPromotion,
  Weekday,
} from "./promotion.types";

interface ExpandedUnit {
  lineId: number;
  unitIndex: number;
  productId: number;
  categoryId: number;
  baseUnitPricePaise: number;
  customizationUnitPricePaise: number;
}

const assertPositiveSafeInteger = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
};

const assertNonNegativeSafeInteger = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
};

const assertNullablePositiveInteger = (value: number | null, label: string) => {
  if (value !== null) assertPositiveSafeInteger(value, label);
};

const assertPromotionRuntimeShape = (promotion: PromotionRecord) => {
  assertPositiveSafeInteger(promotion.id, "Promotion ID");
  assertPositiveSafeInteger(
    promotion.definitionVersion,
    "Promotion definition version"
  );
  assertNonNegativePaise(
    promotion.minimumOrderPaise,
    MONEY_CAPS.ORDER_AMOUNT,
    "Promotion minimum order"
  );
  assertNonNegativeSafeInteger(
    promotion.minimumCartQuantity,
    "Promotion minimum cart quantity"
  );
  assertNullablePositiveInteger(
    promotion.perUserRedemptionLimit,
    "Per-user redemption limit"
  );
  assertNullablePositiveInteger(
    promotion.maxRedemptions,
    "Global redemption limit"
  );
  if (promotion.totalDiscountBudgetPaise !== null) {
    assertNonNegativePaise(
      promotion.totalDiscountBudgetPaise,
      MAX_POSTGRES_INT,
      "Promotion discount budget"
    );
    if (promotion.totalDiscountBudgetPaise === 0) {
      throw new RangeError("Promotion discount budget must be positive");
    }
  }
  assertNonNegativeSafeInteger(promotion.displayPriority, "Display priority");
  if (
    (promotion.kind === "offer" && promotion.code !== null) ||
    (promotion.kind === "coupon" &&
      (promotion.code === null ||
        promotion.code.length === 0 ||
        promotion.code !== promotion.code.trim().toUpperCase()))
  ) {
    throw new RangeError("Promotion kind and normalized code are inconsistent");
  }
};

const compareUnits = (left: ExpandedUnit, right: ExpandedUnit) =>
  left.lineId - right.lineId || left.unitIndex - right.unitIndex;

const allocationSort = (
  left: PromotionAllocation,
  right: PromotionAllocation
) => {
  if (left.component !== right.component) return left.component === "item" ? -1 : 1;
  if (left.component === "delivery" || right.component === "delivery") return 0;
  return left.lineId - right.lineId || left.unitIndex - right.unitIndex;
};

const validateAndExpandItems = (items: PromotionItemInput[]) => {
  const lineIds = new Set<number>();
  let expandedCount = 0;
  const units: ExpandedUnit[] = [];

  for (const item of [...items].sort((left, right) => left.lineId - right.lineId)) {
    assertPositiveSafeInteger(item.lineId, "Line ID");
    assertPositiveSafeInteger(item.productId, "Product ID");
    assertPositiveSafeInteger(item.categoryId, "Category ID");
    assertPositiveSafeInteger(item.quantity, "Item quantity");
    if (lineIds.has(item.lineId)) {
      throw new RangeError(`Duplicate line ID ${item.lineId}`);
    }
    lineIds.add(item.lineId);
    assertNonNegativePaise(
      item.baseUnitPricePaise,
      MONEY_CAPS.ITEM_PRICE,
      "Base unit price"
    );
    assertNonNegativePaise(
      item.customizationUnitPricePaise,
      MONEY_CAPS.CUSTOMIZATION_PRICE,
      "Customization unit price"
    );
    addPaise(
      [item.baseUnitPricePaise, item.customizationUnitPricePaise],
      MONEY_CAPS.ITEM_PRICE,
      "Priced unit"
    );

    expandedCount += item.quantity;
    if (
      !Number.isSafeInteger(expandedCount) ||
      expandedCount > PROMOTION_MAX_EXPANDED_UNITS
    ) {
      throw new RangeError(
        `Cart exceeds the promotion engine limit of ${PROMOTION_MAX_EXPANDED_UNITS} units`
      );
    }
    for (let unitIndex = 0; unitIndex < item.quantity; unitIndex += 1) {
      units.push({
        lineId: item.lineId,
        unitIndex,
        productId: item.productId,
        categoryId: item.categoryId,
        baseUnitPricePaise: item.baseUnitPricePaise,
        customizationUnitPricePaise: item.customizationUnitPricePaise,
      });
    }
  }

  return units;
};

const unitValue = (unit: ExpandedUnit, includeCustomizationValue: boolean) =>
  addPaise(
    [
      unit.baseUnitPricePaise,
      includeCustomizationValue ? unit.customizationUnitPricePaise : 0,
    ],
    MONEY_CAPS.ITEM_PRICE,
    "Promotion unit basis"
  );

const fullCartSubtotal = (items: PromotionItemInput[]) =>
  addPaise(
    items.map((item) => {
      const unitPrice = addPaise(
        [item.baseUnitPricePaise, item.customizationUnitPricePaise],
        MONEY_CAPS.ITEM_PRICE,
        "Priced unit"
      );
      return multiplyPaiseByQuantity(
        unitPrice,
        item.quantity,
        MONEY_CAPS.ORDER_AMOUNT
      );
    }),
    MONEY_CAPS.ORDER_AMOUNT,
    "Cart subtotal"
  );

const parseLocalTime = (time: string) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new RangeError(`Invalid local time ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
};

const localClock = (now: Date, timezone: string) => {
  if (Number.isNaN(now.getTime())) throw new RangeError("Invalid evaluation time");
  try {
    const values = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value])
    );
    const weekday = WEEKDAY_BY_SHORT_NAME[
      values.weekday as keyof typeof WEEKDAY_BY_SHORT_NAME
    ];
    const hour = Number(values.hour);
    const minute = Number(values.minute);
    if (weekday === undefined || !Number.isInteger(hour) || !Number.isInteger(minute)) {
      throw new RangeError("Incomplete local clock");
    }
    return { weekday, minuteOfDay: hour * 60 + minute };
  } catch {
    throw new RangeError(`Invalid IANA timezone ${timezone}`);
  }
};

const previousWeekday = (weekday: Weekday): Weekday =>
  ((weekday + 6) % 7) as Weekday;

const timeEligibilityReason = (
  promotion: PromotionRecord,
  now: Date,
  timezone: string
): PromotionIneligibilityReasonCode | null => {
  const { weekday, minuteOfDay } = localClock(now, timezone);
  const { activeStartTime, activeEndTime, activeDaysOfWeek } = promotion;

  if (activeStartTime === null && activeEndTime === null) {
    if (activeDaysOfWeek !== null && !activeDaysOfWeek.includes(weekday)) {
      return PROMOTION_INELIGIBILITY_REASONS.DAY_RESTRICTED;
    }
    return null;
  }
  if (activeStartTime === null || activeEndTime === null) {
    throw new RangeError("Promotion time window must be complete");
  }

  const start = parseLocalTime(activeStartTime);
  const end = parseLocalTime(activeEndTime);
  if (start === end) throw new RangeError("Promotion time window cannot be empty");

  let ownerWeekday: Weekday;
  if (start < end) {
    ownerWeekday = weekday;
    if (activeDaysOfWeek !== null && !activeDaysOfWeek.includes(ownerWeekday)) {
      return PROMOTION_INELIGIBILITY_REASONS.DAY_RESTRICTED;
    }
    if (minuteOfDay < start || minuteOfDay >= end) {
      return PROMOTION_INELIGIBILITY_REASONS.TIME_RESTRICTED;
    }
    return null;
  }

  if (minuteOfDay >= start) {
    ownerWeekday = weekday;
  } else if (minuteOfDay < end) {
    ownerWeekday = previousWeekday(weekday);
  } else {
    return PROMOTION_INELIGIBILITY_REASONS.TIME_RESTRICTED;
  }

  if (activeDaysOfWeek !== null && !activeDaysOfWeek.includes(ownerWeekday)) {
    return PROMOTION_INELIGIBILITY_REASONS.DAY_RESTRICTED;
  }
  return null;
};

const productTargetIds = (promotion: PromotionRecord) => {
  const ids = new Set<number>();
  for (const rule of promotion.rules) {
    if (rule.type === "product_include") ids.add(rule.productId);
    if (rule.type === "buy_x_get_y") {
      rule.buyProductIds.forEach((id) => ids.add(id));
      rule.getProductIds.forEach((id) => ids.add(id));
    }
  }
  return ids;
};

const categoryTargetIds = (promotion: PromotionRecord) => {
  const ids = new Set<number>();
  for (const rule of promotion.rules) {
    if (rule.type === "category_include") ids.add(rule.categoryId);
    if (rule.type === "buy_x_get_y") {
      rule.buyCategoryIds.forEach((id) => ids.add(id));
      rule.getCategoryIds.forEach((id) => ids.add(id));
    }
  }
  return ids;
};

const targetsPresent = (promotion: PromotionRecord, items: PromotionItemInput[]) => {
  if (promotion.scope === "product") {
    const targets = productTargetIds(promotion);
    return items.some((item) => targets.has(item.productId));
  }
  if (promotion.scope === "category") {
    const targets = categoryTargetIds(promotion);
    return items.some((item) => targets.has(item.categoryId));
  }
  return true;
};

export const evaluateEligibility = (
  promotion: PromotionRecord,
  context: PromotionEvaluationContext
): import("./promotion.types").PromotionEligibilityResult => {
  assertPromotionRuntimeShape(promotion);
  if (!promotion.isActive) {
    return { eligible: false, errorCode: PROMOTION_ERROR_CODES.NOT_ACTIVE };
  }
  if (!context.storeEnabled) {
    return {
      eligible: false,
      errorCode: PROMOTION_ERROR_CODES.DISABLED_FOR_STORE,
    };
  }
  if (
    Number.isNaN(context.now.getTime()) ||
    Number.isNaN(promotion.startsAt.getTime()) ||
    Number.isNaN(promotion.endsAt.getTime()) ||
    promotion.endsAt <= promotion.startsAt
  ) {
    throw new RangeError("Promotion validity window is invalid");
  }
  if (context.now < promotion.startsAt || context.now >= promotion.endsAt) {
    return {
      eligible: false,
      errorCode: PROMOTION_ERROR_CODES.INELIGIBLE,
      reasonCode: PROMOTION_INELIGIBILITY_REASONS.DATE_RESTRICTED,
    };
  }

  const clockReason = timeEligibilityReason(
    promotion,
    context.now,
    context.timezone
  );
  if (clockReason !== null) {
    return {
      eligible: false,
      errorCode: PROMOTION_ERROR_CODES.INELIGIBLE,
      reasonCode: clockReason,
    };
  }

  assertNonNegativeSafeInteger(
    context.globalRedemptionsUsed,
    "Global redemption usage"
  );
  assertNonNegativeSafeInteger(
    context.userRedemptionsUsed,
    "User redemption usage"
  );
  assertNonNegativeSafeInteger(
    context.qualifyingOrderCount,
    "Qualifying order count"
  );
  assertNonNegativePaise(
    context.budgetUsedPaise,
    MAX_POSTGRES_INT,
    "Promotion budget usage"
  );

  if (
    promotion.firstOrderOnly ||
    promotion.perUserRedemptionLimit !== null
  ) {
    if (context.userId === null) {
      return {
        eligible: false,
        errorCode: PROMOTION_ERROR_CODES.INELIGIBLE,
        reasonCode: PROMOTION_INELIGIBILITY_REASONS.AUTHENTICATION_REQUIRED,
      };
    }
  }
  if (context.userId !== null) assertPositiveSafeInteger(context.userId, "User ID");
  if (promotion.firstOrderOnly && context.qualifyingOrderCount > 0) {
    return {
      eligible: false,
      errorCode: PROMOTION_ERROR_CODES.INELIGIBLE,
      reasonCode: PROMOTION_INELIGIBILITY_REASONS.FIRST_ORDER_REQUIRED,
    };
  }
  if (
    promotion.perUserRedemptionLimit !== null &&
    context.userRedemptionsUsed >= promotion.perUserRedemptionLimit
  ) {
    return {
      eligible: false,
      errorCode: PROMOTION_ERROR_CODES.INELIGIBLE,
      reasonCode: PROMOTION_INELIGIBILITY_REASONS.PER_USER_LIMIT_REACHED,
    };
  }
  if (
    promotion.maxRedemptions !== null &&
    context.globalRedemptionsUsed >= promotion.maxRedemptions
  ) {
    return {
      eligible: false,
      errorCode: PROMOTION_ERROR_CODES.CAPACITY_EXHAUSTED,
    };
  }
  if (
    promotion.totalDiscountBudgetPaise !== null &&
    context.budgetUsedPaise >= promotion.totalDiscountBudgetPaise
  ) {
    return {
      eligible: false,
      errorCode: PROMOTION_ERROR_CODES.BUDGET_EXHAUSTED,
    };
  }

  const units = validateAndExpandItems(context.items);
  const subtotal = fullCartSubtotal(context.items);
  if (subtotal < promotion.minimumOrderPaise) {
    return {
      eligible: false,
      errorCode: PROMOTION_ERROR_CODES.INELIGIBLE,
      reasonCode: PROMOTION_INELIGIBILITY_REASONS.MINIMUM_ORDER_NOT_MET,
    };
  }
  if (units.length < promotion.minimumCartQuantity) {
    return {
      eligible: false,
      errorCode: PROMOTION_ERROR_CODES.INELIGIBLE,
      reasonCode: PROMOTION_INELIGIBILITY_REASONS.MINIMUM_QUANTITY_NOT_MET,
    };
  }
  if (!targetsPresent(promotion, context.items)) {
    return {
      eligible: false,
      errorCode: PROMOTION_ERROR_CODES.INELIGIBLE,
      reasonCode:
        promotion.scope === "product"
          ? PROMOTION_INELIGIBILITY_REASONS.PRODUCT_TARGET_NOT_PRESENT
          : PROMOTION_INELIGIBILITY_REASONS.CATEGORY_TARGET_NOT_PRESENT,
    };
  }
  return { eligible: true };
};

const matchesTarget = (promotion: PromotionRecord, unit: ExpandedUnit) => {
  if (promotion.scope === "cart") return true;
  if (promotion.scope === "product") {
    return promotion.rules.some(
      (rule) => rule.type === "product_include" && rule.productId === unit.productId
    );
  }
  if (promotion.scope === "category") {
    return promotion.rules.some(
      (rule) =>
        rule.type === "category_include" && rule.categoryId === unit.categoryId
    );
  }
  return false;
};

const allocateAcrossUnits = (
  amountPaise: number,
  units: ExpandedUnit[],
  includeCustomizationValue: boolean
): PromotionItemAllocation[] => {
  if (amountPaise === 0) return [];
  const orderedUnits = [...units].sort(compareUnits);
  const weights = orderedUnits.map((unit) =>
    unitValue(unit, includeCustomizationValue)
  );
  const allocations = allocateProportional(
    amountPaise,
    weights.map((weight, index) => ({ id: index, weight }))
  );
  return allocations.flatMap((allocation) => {
    if (allocation.allocatedPaise === 0) return [];
    const unit = orderedUnits[allocation.id];
    return [
      {
        component: "item" as const,
        lineId: unit.lineId,
        unitIndex: unit.unitIndex,
        amountPaise: allocation.allocatedPaise,
      },
    ];
  });
};

const calculateRateOrFixed = (
  discount:
    | { type: "percentage"; rateBps: number; maxDiscountPaise: number | null }
    | { type: "fixed_amount"; amountPaise: number },
  units: ExpandedUnit[],
  includeCustomizationValue: boolean
) => {
  const eligibleBasis = addPaise(
    units.map((unit) => unitValue(unit, includeCustomizationValue)),
    MONEY_CAPS.ORDER_AMOUNT,
    "Promotion eligible basis"
  );
  if (eligibleBasis === 0) return 0;

  if (discount.type === "fixed_amount") {
    assertNonNegativePaise(
      discount.amountPaise,
      MONEY_CAPS.DISCOUNT,
      "Fixed promotion amount"
    );
    if (discount.amountPaise === 0) {
      throw new RangeError("Fixed promotion amount must be positive");
    }
    return Math.min(discount.amountPaise, eligibleBasis);
  }

  if (
    !Number.isInteger(discount.rateBps) ||
    discount.rateBps <= 0 ||
    discount.rateBps > BASIS_POINTS_SCALE
  ) {
    throw new RangeError("Promotion rate basis points are invalid");
  }
  const uncapped = calculateBasisPoints(eligibleBasis, discount.rateBps);
  if (discount.maxDiscountPaise === null) return Math.min(uncapped, eligibleBasis);
  assertNonNegativePaise(
    discount.maxDiscountPaise,
    MONEY_CAPS.DISCOUNT,
    "Promotion discount cap"
  );
  if (discount.maxDiscountPaise === 0) {
    throw new RangeError("Promotion discount cap must be positive");
  }
  return Math.min(uncapped, discount.maxDiscountPaise, eligibleBasis);
};

const targetMatch = (
  unit: ExpandedUnit,
  productIds: number[],
  categoryIds: number[]
) => productIds.includes(unit.productId) || categoryIds.includes(unit.categoryId);

const calculateBxgyAllocations = (
  rule: Extract<PromotionRule, { type: "buy_x_get_y" }>,
  units: ExpandedUnit[]
): PromotionItemAllocation[] => {
  assertPositiveSafeInteger(rule.buyQuantity, "BXGY buy quantity");
  assertPositiveSafeInteger(rule.getQuantity, "BXGY get quantity");
  const buyUnits = units.filter((unit) =>
    targetMatch(unit, rule.buyProductIds, rule.buyCategoryIds)
  );
  const getUnits = units
    .filter((unit) => targetMatch(unit, rule.getProductIds, rule.getCategoryIds))
    .sort(
      (left, right) =>
        left.baseUnitPricePaise - right.baseUnitPricePaise ||
        compareUnits(left, right)
    );
  const buyKeys = new Set(
    buyUnits.map((unit) => `${unit.lineId}:${unit.unitIndex}`)
  );

  const maxGroups = Math.min(
    Math.floor(buyUnits.length / rule.buyQuantity),
    Math.floor(getUnits.length / rule.getQuantity)
  );
  for (let groups = maxGroups; groups > 0; groups -= 1) {
    const requiredGetUnits = groups * rule.getQuantity;
    const maximumOverlappingGets = buyUnits.length - groups * rule.buyQuantity;
    const selected: ExpandedUnit[] = [];
    let overlappingGets = 0;

    for (const unit of getUnits) {
      const overlapsBuyPool = buyKeys.has(`${unit.lineId}:${unit.unitIndex}`);
      if (overlapsBuyPool && overlappingGets >= maximumOverlappingGets) continue;
      selected.push(unit);
      if (overlapsBuyPool) overlappingGets += 1;
      if (selected.length === requiredGetUnits) break;
    }

    if (selected.length === requiredGetUnits) {
      return selected.flatMap((unit) =>
        unit.baseUnitPricePaise === 0
          ? []
          : [
              {
                component: "item" as const,
                lineId: unit.lineId,
                unitIndex: unit.unitIndex,
                amountPaise: unit.baseUnitPricePaise,
              },
            ]
      );
    }
  }
  return [];
};

export const calculateDiscount = (
  promotion: PromotionRecord,
  items: PromotionItemInput[],
  deliveryFeePaise = 0
): PromotionCandidate | null => {
  assertPromotionRuntimeShape(promotion);
  const units = validateAndExpandItems(items);
  assertNonNegativePaise(
    deliveryFeePaise,
    MONEY_CAPS.DELIVERY_FEE,
    "Delivery fee"
  );

  let allocations: PromotionAllocation[];
  if (promotion.discount.type === "free_delivery") {
    allocations =
      deliveryFeePaise === 0
        ? []
        : [
            {
              component: "delivery",
              lineId: null,
              unitIndex: null,
              amountPaise: deliveryFeePaise,
            },
          ];
  } else if (promotion.discount.type === "buy_x_get_y") {
    const rule = promotion.rules.find(
      (item): item is Extract<PromotionRule, { type: "buy_x_get_y" }> =>
        item.type === "buy_x_get_y"
    );
    if (!rule) throw new RangeError("BXGY promotion requires one complete rule");
    allocations = calculateBxgyAllocations(rule, units);
  } else if (promotion.discount.type === "tiered") {
    const subtotal = fullCartSubtotal(items);
    const tier = promotion.rules
      .filter(
        (rule): rule is Extract<PromotionRule, { type: "tier" }> =>
          rule.type === "tier" && rule.minimumSubtotalPaise <= subtotal
      )
      .sort(
        (left, right) => right.minimumSubtotalPaise - left.minimumSubtotalPaise
      )[0];
    if (!tier) return null;
    const amount = calculateRateOrFixed(
      tier.discount,
      units,
      promotion.includeCustomizationValue
    );
    allocations = allocateAcrossUnits(
      amount,
      units,
      promotion.includeCustomizationValue
    );
  } else {
    const eligibleUnits = units.filter((unit) => matchesTarget(promotion, unit));
    const amount = calculateRateOrFixed(
      promotion.discount,
      eligibleUnits,
      promotion.includeCustomizationValue
    );
    allocations = allocateAcrossUnits(
      amount,
      eligibleUnits,
      promotion.includeCustomizationValue
    );
  }

  if (allocations.length === 0) return null;
  return { promotion, allocations: allocations.sort(allocationSort) };
};

const allocationKey = (allocation: PromotionAllocation) =>
  allocation.component === "delivery"
    ? "delivery"
    : `item:${allocation.lineId}:${allocation.unitIndex}`;

const candidateWins = (
  challenger: { candidate: PromotionCandidate; allocation: PromotionAllocation },
  incumbent: { candidate: PromotionCandidate; allocation: PromotionAllocation }
) =>
  challenger.allocation.amountPaise > incumbent.allocation.amountPaise ||
  (challenger.allocation.amountPaise === incumbent.allocation.amountPaise &&
    (challenger.candidate.promotion.displayPriority >
      incumbent.candidate.promotion.displayPriority ||
      (challenger.candidate.promotion.displayPriority ===
        incumbent.candidate.promotion.displayPriority &&
        challenger.candidate.promotion.id < incumbent.candidate.promotion.id)));

const toResolvedPromotion = (
  promotion: PromotionRecord,
  allocations: PromotionAllocation[]
): ResolvedPromotion => {
  const itemDiscountPaise = addPaise(
    allocations
      .filter(
        (allocation): allocation is PromotionItemAllocation =>
          allocation.component === "item"
      )
      .map((allocation) => allocation.amountPaise),
    MONEY_CAPS.DISCOUNT,
    "Promotion item savings"
  );
  const deliveryDiscountPaise = addPaise(
    allocations
      .filter((allocation) => allocation.component === "delivery")
      .map((allocation) => allocation.amountPaise),
    MONEY_CAPS.DELIVERY_FEE,
    "Promotion delivery savings"
  );
  return {
    id: promotion.id,
    definitionVersion: promotion.definitionVersion,
    kind: promotion.kind,
    name: promotion.name,
    code: promotion.code,
    discountType: promotion.discount.type,
    displayPriority: promotion.displayPriority,
    itemDiscountPaise,
    deliveryDiscountPaise,
    totalSavingsPaise: addPaise(
      [itemDiscountPaise, deliveryDiscountPaise],
      MAX_POSTGRES_INT,
      "Promotion total savings"
    ),
    allocations: [...allocations].sort(allocationSort),
  };
};

export const findBestOffersByUnit = (
  eligibleOffers: PromotionCandidate[],
  _items?: PromotionItemInput[]
): ResolvedPromotion[] => {
  const winners = new Map<
    string,
    { candidate: PromotionCandidate; allocation: PromotionAllocation }
  >();

  for (const candidate of eligibleOffers) {
    assertPromotionRuntimeShape(candidate.promotion);
    if (candidate.promotion.kind !== "offer") {
      throw new RangeError("Only offers can participate in automatic resolution");
    }
    const candidateKeys = new Set<string>();
    for (const allocation of candidate.allocations) {
      assertNonNegativePaise(
        allocation.amountPaise,
        MAX_POSTGRES_INT,
        "Promotion allocation"
      );
      if (allocation.amountPaise === 0) {
        throw new RangeError("Promotion allocations must be positive");
      }
      if (allocation.component === "item") {
        assertPositiveSafeInteger(allocation.lineId, "Allocation line ID");
        assertNonNegativeSafeInteger(allocation.unitIndex, "Allocation unit index");
      }
      const key = allocationKey(allocation);
      if (candidateKeys.has(key)) {
        throw new RangeError(
          `Promotion ${candidate.promotion.id} contains a duplicate allocation`
        );
      }
      candidateKeys.add(key);
      const incumbent = winners.get(key);
      const challenger = { candidate, allocation };
      if (!incumbent || candidateWins(challenger, incumbent)) {
        winners.set(key, challenger);
      }
    }
  }

  const allocationsByPromotion = new Map<
    number,
    { promotion: PromotionRecord; allocations: PromotionAllocation[] }
  >();
  for (const { candidate, allocation } of winners.values()) {
    const existing = allocationsByPromotion.get(candidate.promotion.id);
    if (existing) existing.allocations.push(allocation);
    else {
      allocationsByPromotion.set(candidate.promotion.id, {
        promotion: candidate.promotion,
        allocations: [allocation],
      });
    }
  }

  return [...allocationsByPromotion.values()]
    .map(({ promotion, allocations }) =>
      toResolvedPromotion(promotion, allocations)
    )
    .filter((promotion) => promotion.totalSavingsPaise > 0)
    .sort((left, right) => left.id - right.id);
};

const sumResolution = (
  promotions: ResolvedPromotion[],
  couponEligibility: CouponEligibility,
  discountMode: "none" | "automatic_deals" | "coupon"
): PromotionResolution => {
  const itemDiscountPaise = addPaise(
    promotions.map((promotion) => promotion.itemDiscountPaise),
    MONEY_CAPS.DISCOUNT,
    "Resolved item savings"
  );
  const deliveryDiscountPaise = addPaise(
    promotions.map((promotion) => promotion.deliveryDiscountPaise),
    MONEY_CAPS.DELIVERY_FEE,
    "Resolved delivery savings"
  );
  return {
    ok: true,
    discountMode,
    promotions,
    itemDiscountPaise,
    deliveryDiscountPaise,
    promotionSavingsPaise: addPaise(
      [itemDiscountPaise, deliveryDiscountPaise],
      MAX_POSTGRES_INT,
      "Resolved promotion savings"
    ),
    couponEligibility,
  };
};

const failedResolution = (
  errorCode: FailedPromotionResolution["errorCode"],
  couponEligibility: CouponEligibility,
  reasonCode?: PromotionIneligibilityReasonCode
): FailedPromotionResolution => ({
  ok: false,
  errorCode,
  ...(reasonCode ? { reasonCode } : {}),
  couponEligibility,
});

const evaluationContextFor = (
  promotion: PromotionRecord,
  context: PromotionResolutionContext
): PromotionEvaluationContext => {
  const usage = context.usageByPromotionId[promotion.id];
  if (!usage) {
    throw new RangeError(`Missing usage context for promotion ${promotion.id}`);
  }
  return {
    now: context.now,
    timezone: context.timezone,
    userId: context.userId,
    qualifyingOrderCount: context.qualifyingOrderCount,
    deliveryFeePaise: context.deliveryFeePaise,
    items: context.items,
    ...usage,
  };
};

const candidateFitsBudget = (
  candidate: PromotionCandidate,
  context: PromotionEvaluationContext
) => {
  const budget = candidate.promotion.totalDiscountBudgetPaise;
  if (budget === null) return true;
  const saving = addPaise(
    candidate.allocations.map((allocation) => allocation.amountPaise),
    MAX_POSTGRES_INT,
    "Promotion candidate savings"
  );
  return saving <= budget - context.budgetUsedPaise;
};

export interface ResolvePromotionSetInput {
  promotions: PromotionRecord[];
  couponCode?: string | null;
  context: PromotionResolutionContext;
}

export const resolvePromotionSet = ({
  promotions,
  couponCode,
  context,
}: ResolvePromotionSetInput): PromotionResolution => {
  validateAndExpandItems(context.items);
  assertNonNegativePaise(
    context.deliveryFeePaise,
    MONEY_CAPS.DELIVERY_FEE,
    "Delivery fee"
  );
  assertNonNegativeSafeInteger(
    context.qualifyingOrderCount,
    "Qualifying order count"
  );
  if (context.userId !== null) assertPositiveSafeInteger(context.userId, "User ID");
  const promotionIds = new Set<number>();
  for (const promotion of promotions) {
    assertPositiveSafeInteger(promotion.id, "Promotion ID");
    if (promotionIds.has(promotion.id)) {
      throw new RangeError(`Duplicate promotion ID ${promotion.id}`);
    }
    promotionIds.add(promotion.id);
  }

  const offerCandidates: PromotionCandidate[] = [];
  for (const offer of promotions.filter((promotion) => promotion.kind === "offer")) {
    const evaluationContext = evaluationContextFor(offer, context);
    if (!evaluateEligibility(offer, evaluationContext).eligible) continue;
    const candidate = calculateDiscount(
      offer,
      context.items,
      context.deliveryFeePaise
    );
    if (candidate && candidateFitsBudget(candidate, evaluationContext)) {
      offerCandidates.push(candidate);
    }
  }
  const resolvedOffers = findBestOffersByUnit(offerCandidates, context.items);
  const bundleLineIds = context.items
    .filter((item) => item.productType === "bundle")
    .map((item) => item.lineId);
  const offerLineIds = resolvedOffers.flatMap((promotion) =>
    promotion.allocations.flatMap((allocation) =>
      allocation.component === "item" ? [allocation.lineId] : []
    )
  );
  const conflictingLineIds = [...new Set([...offerLineIds, ...bundleLineIds])].sort(
    (left, right) => left - right
  );
  const couponEligibility: CouponEligibility =
    resolvedOffers.length > 0
      ? {
          eligible: false,
          reasonCode: COUPON_CONFLICT_REASONS.OFFER_APPLIED,
          conflictingLineIds,
        }
      : bundleLineIds.length > 0
        ? {
            eligible: false,
            reasonCode: COUPON_CONFLICT_REASONS.DEAL_BUNDLE_PRESENT,
            conflictingLineIds,
          }
        : { eligible: true, reasonCode: null, conflictingLineIds: [] };

  if (couponCode !== undefined && couponCode !== null) {
    if (!couponEligibility.eligible) {
      return failedResolution(
        PROMOTION_ERROR_CODES.COUPON_NOT_COMBINABLE,
        couponEligibility
      );
    }
    const normalizedCode = couponCode.trim().toUpperCase();
    const coupon = promotions.find(
      (promotion) =>
        promotion.kind === "coupon" && promotion.code === normalizedCode
    );
    if (!coupon) {
      return failedResolution(PROMOTION_ERROR_CODES.NOT_FOUND, couponEligibility);
    }
    const evaluationContext = evaluationContextFor(coupon, context);
    const eligibility = evaluateEligibility(coupon, evaluationContext);
    if (!eligibility.eligible) {
      return failedResolution(
        eligibility.errorCode,
        couponEligibility,
        eligibility.reasonCode
      );
    }
    const candidate = calculateDiscount(
      coupon,
      context.items,
      context.deliveryFeePaise
    );
    if (!candidate) {
      return failedResolution(
        PROMOTION_ERROR_CODES.INELIGIBLE,
        couponEligibility
      );
    }
    if (!candidateFitsBudget(candidate, evaluationContext)) {
      return failedResolution(
        PROMOTION_ERROR_CODES.BUDGET_EXHAUSTED,
        couponEligibility
      );
    }
    return sumResolution(
      [toResolvedPromotion(coupon, candidate.allocations)],
      couponEligibility,
      "coupon"
    );
  }

  return sumResolution(
    resolvedOffers,
    couponEligibility,
    resolvedOffers.length > 0 || bundleLineIds.length > 0
      ? "automatic_deals"
      : "none"
  );
};
