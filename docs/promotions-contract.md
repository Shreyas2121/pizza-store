# Promotions and offers API contract

- Status: Frozen for C02-C14 implementation
- Contract date: 2026-09-12
- Branch: `feature/promotions-overhaul`
- Related decisions: [ADR-006](adr/0006-promotion-resolution-eligibility-and-governance.md), [ADR-007](adr/0007-bundle-pricing-promotion-accounting-and-snapshots.md), [ADR-008](adr/0008-promotion-media-storage-and-cleanup.md), [ADR-001](adr/0001-money-representation-and-rounding.md), [ADR-004](adr/0004-tax-inclusive-demo-policy.md)

## 1. Contract rules

1. JSON fields use `camelCase`; persisted columns may use `snake_case`.
2. Transaction amounts are safe integer paise JSON numbers. Report/analytics aggregates are base-10 paise strings under ADR-001.
3. Timestamps are UTC ISO-8601 strings. Store-local time values are strict `HH:mm` strings and are interpreted with the store's IANA timezone.
4. Request objects are strict. Unknown keys, unsafe integers, invalid discriminants, and inconsistent cross-fields are rejected.
5. Success responses use `{ "data": ... }`. List responses put pagination beside the collection inside `data`. Errors use `{ "message": string, "code": string, "data"?: object }`.
6. `null` means unlimited or absent where declared. The new contract never accepts or returns `-1` as an unlimited sentinel.
7. `quoteVersion` is `2026-09-12-03`, `pricingPolicyVersion` is `4`, and a new promotion starts at `definitionVersion = 1`. These values have named constants in their authoritative backend modules.
8. This is the only target promotion/coupon contract. There are no legacy response adapters, redirects, or dual read/write requirements.

Named contract limits are frozen for matching backend and frontend validation:

| Constant | Value |
| --- | ---: |
| `PROMOTION_NAME_MAX_LENGTH` | 120 characters |
| `PROMOTION_DESCRIPTION_MAX_LENGTH` | 1,000 characters |
| `PROMOTION_CODE_MAX_LENGTH` | 64 characters after trimming |
| `PROMOTION_IMAGE_ALT_MAX_LENGTH` | 200 characters |
| `STORE_PROMOTION_REASON_MAX_LENGTH` | 500 characters |
| `PROMOTION_LIST_DEFAULT_PAGE_SIZE` | 25 |
| `PROMOTION_LIST_MAX_PAGE_SIZE` | 100 |
| `PROMOTION_LIST_MAX_PAGE` | 21,474,836 (bounds SQL offsets within PostgreSQL integer limits) |
| `PROMOTION_IMAGE_MAX_BYTES` | 5,242,880 bytes (5 MiB) |
| `PROMOTION_DESKTOP_MIN_WIDTH` / `MIN_HEIGHT` | 1,200 / 400 pixels |
| `PROMOTION_MOBILE_MIN_WIDTH` / `MIN_HEIGHT` | 600 / 600 pixels |
| `PROMOTION_IMAGE_MAX_WIDTH` / `MAX_HEIGHT` | 4,096 / 2,160 pixels |
| `HOMEPAGE_FEATURED_OFFER_LIMIT` | 8 |
| `HOMEPAGE_SLIDE_INTERVAL_MS` | 6,000 ms when timed rotation is enabled |
| `PROMOTION_MEDIA_ORPHAN_MIN_AGE_MS` | 86,400,000 ms (24 hours) |

Allowed decoded media formats are JPEG, PNG, and WebP, with canonical MIME/extension pairs. SVG, GIF, animated content, and format/header mismatches are rejected. Promotion applications use the existing online order/inventory reservation expiry; they do not introduce a separate promotion TTL.

## 2. Shared discriminants

```ts
type DiscountMode = "none" | "automatic_deals" | "coupon";
type PromotionKind = "offer" | "coupon";
type DiscountType =
  | "percentage"
  | "fixed_amount"
  | "buy_x_get_y"
  | "free_delivery"
  | "tiered";
type PromotionScope = "cart" | "product" | "category" | "delivery";
type PromotionApplicationStatus = "reserved" | "consumed" | "released";
type PromotionMediaVariant = "desktop" | "mobile";
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday through Saturday
```

Allowed kind/type/scope combinations are closed:

| Kind | Discount type | Allowed scope |
| --- | --- | --- |
| `coupon` | `percentage`, `fixed_amount`, `tiered` | `cart` only |
| `offer` | `percentage`, `fixed_amount` | `cart`, `product`, or `category` |
| `offer` | `buy_x_get_y` | `product` or `category` |
| `offer` | `free_delivery` | `delivery` only |
| `offer` | `tiered` | `cart` only |

Coupons require a normalized non-empty code and offers forbid a code. Coupon codes are trimmed and uppercased before lookup and persistence.

## 3. Definition DTOs

### 3.1 Discount and rule DTOs

```ts
type PromotionDiscountDto =
  | {
      type: "percentage";
      rateBps: number;              // 1..10_000
      maxDiscountPaise: number | null;
    }
  | {
      type: "fixed_amount";
      amountPaise: number;          // positive
    }
  | { type: "buy_x_get_y" }
  | { type: "free_delivery" }
  | { type: "tiered" };

type PromotionRuleDto =
  | { type: "product_include"; productId: number }
  | { type: "category_include"; categoryId: number }
  | {
      type: "buy_x_get_y";
      buyQuantity: number;
      getQuantity: number;
      buyProductIds: number[];
      buyCategoryIds: number[];
      getProductIds: number[];
      getCategoryIds: number[];
    }
  | {
      type: "tier";
      minimumSubtotalPaise: number;
      discount:
        | {
            type: "percentage";
            rateBps: number;
            maxDiscountPaise: number | null;
          }
        | { type: "fixed_amount"; amountPaise: number };
    };
```

Rules are returned in deterministic order: rule type, threshold/target ID, then rule ID. Product/category scopes require at least one matching include rule. BXGY requires exactly one complete `buy_x_get_y` rule with at least one buy target and one get target. Tier thresholds are unique and returned ascending; the engine selects the highest qualifying tier.

`includeCustomizationValue` is valid for percentage, fixed-amount, and tiered definitions and defaults to `false`; BXGY and free-delivery definitions require `false`. Tier qualification always uses the complete pre-promotion item subtotal, while the selected tier's discount basis follows `includeCustomizationValue`.

### 3.2 Admin definition

```ts
interface PromotionAdminDto {
  id: number;
  definitionVersion: number;
  kind: PromotionKind;
  name: string;
  description: string;
  code: string | null;
  discount: PromotionDiscountDto;
  scope: PromotionScope;
  includeCustomizationValue: boolean;
  eligibility: {
    minimumOrderPaise: number;
    minimumCartQuantity: number;
    firstOrderOnly: boolean;
  };
  validity: {
    startsAt: string;
    endsAt: string;
    activeDaysOfWeek: Weekday[] | null;
    activeStartTime: string | null;
    activeEndTime: string | null;
  };
  limits: {
    perUserRedemptions: number | null;
    globalRedemptions: number | null;
    budgetPaise: number | null;
  };
  display: {
    priority: number;
    showOnHomepage: boolean;
    imageUrl: string | null;
    mobileImageUrl: string | null;
    imageAlt: string | null;
  };
  rules: PromotionRuleDto[];
  isActive: boolean;
  status:
    | "scheduled"
    | "active"
    | "expired"
    | "exhausted"
    | "inactive";
  createdAt: string;
  updatedAt: string;
}
```

`status` is derived at read time and is not accepted as a write field. `isActive` is the global administrative switch. Homepage placement is valid only for offer-kind definitions with a desktop image and useful alt text.

### 3.3 Public offer and featured offer

```ts
interface PromotionPublicDto {
  id: number;
  definitionVersion: number;
  kind: "offer";
  name: string;
  description: string;
  discount: PromotionDiscountDto;
  scope: PromotionScope;
  eligibilitySummary: {
    minimumOrderPaise: number;
    minimumCartQuantity: number;
    firstOrderOnly: boolean;
    activeDaysOfWeek: Weekday[] | null;
    activeStartTime: string | null;
    activeEndTime: string | null;
    timezone: string;
    startsAt: string;
    endsAt: string;
  };
  targets: {
    productIds: number[];
    categoryIds: number[];
  };
  rules: PromotionRuleDto[];
  display: {
    priority: number;
    imageUrl: string | null;
    mobileImageUrl: string | null;
    imageAlt: string | null;
  };
}

interface FeaturedPromotionDto extends PromotionPublicDto {
  display: {
    priority: number;
    imageUrl: string;       // non-null for featured offers
    mobileImageUrl: string | null;
    imageAlt: string;       // non-null for featured offers
  };
}
```

Public endpoints return offer-kind definitions only and never contain `code`, budget, redemption limits, internal status, audit metadata, or coupon rows. Public lists order by display priority descending and promotion ID ascending.

### 3.4 Effective store setting

```ts
interface EffectiveStorePromotionDto {
  promotion: Pick<
    PromotionAdminDto,
    | "id"
    | "definitionVersion"
    | "kind"
    | "name"
    | "description"
    | "code"
    | "discount"
    | "scope"
    | "includeCustomizationValue"
    | "eligibility"
    | "validity"
    | "limits"
    | "rules"
    | "isActive"
    | "status"
  >;
  storeId: number;
  explicitSetting: {
    enabled: boolean;
    reason: string | null;
    updatedByUserId: number;
    updatedAt: string;
  } | null;
  effectiveEnabled: boolean;
  effectiveStatus: "enabled" | "store_disabled" | "globally_inactive";
  canToggle: boolean;
}
```

The same-store manager response may contain coupon codes for operational awareness. Customer/public responses may not. `effectiveEnabled` is `promotion.isActive && (explicitSetting?.enabled ?? true)`; global inactivity cannot be overridden at store level.

## 4. Quote, application, and allocation DTOs

### 4.1 Coupon eligibility

```ts
interface CouponEligibilityDto {
  eligible: boolean;
  reasonCode: "OFFER_APPLIED" | "DEAL_BUNDLE_PRESENT" | null;
  conflictingLineIds: number[]; // unique ascending line IDs
}
```

This field answers only whether the cart may attempt a coupon. An eligible cart can still reject a particular code for validity, targeting, usage, or budget reasons.

### 4.2 Quote promotion

```ts
interface QuotePromotionDto {
  id: number;
  definitionVersion: number;
  kind: PromotionKind;
  name: string;
  code: string | null;
  discountType: DiscountType;
  itemDiscountPaise: number;
  deliveryDiscountPaise: number;
  totalSavingsPaise: number;
  applied: true;
  allocations: Array<{
    lineId: number | null;
    component: "item" | "delivery";
    unitIndexes: number[]; // empty for delivery; sorted ascending
    amountPaise: number;
  }>;
}
```

### 4.3 Authoritative pricing quote

```ts
interface PricingQuoteDto {
  quoteVersion: "2026-09-12-03";
  currency: "INR";
  pricingPolicyVersion: 4;
  discountMode: DiscountMode;
  itemsSubtotalPaise: number;
  itemDiscountPaise: number;
  standardDeliveryFeePaise: number;
  chargedDeliveryFeePaise: number;
  deliveryDiscountPaise: number;
  promotionSavingsPaise: number;
  bundleMarkdownPaise: number;
  totalDisplayedSavingsPaise: number;
  roundingAdjustmentPaise: number;
  grandTotalPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  couponEligibility: CouponEligibilityDto;
  promotions: QuotePromotionDto[];
  items: Array<{
    lineId: number;
    productId: number;
    productName: string;
    productType: "single" | "bundle";
    quantity: number;
    baseUnitPricePaise: number;
    customizationUnitPricePaise: number;
    unitPricePaise: number;
    compareAtUnitPricePaise: number | null;
    lineSubtotalPaise: number;
    itemDiscountPaise: number;
    bundleMarkdownPaise: number;
    lineTotalPaise: number;
    taxableAmountPaise: number;
    taxPaise: number;
    taxRateBps: number;
    hsnSacCode: string;
    customizations: Array<{
      customizationOptionId: number;
      name: string;
      pricePaise: number;
    }>;
    bundleComponents: QuoteBundleComponentDto[];
  }>;
  deliveryPricing: {
    ruleId: number;
    ruleVersion: number;
    storeId: number;
    businessDate: string;
    timezone: string;
    standardFeePaise: number;
    chargedFeePaise: number;
  };
  tax: {
    calculationPolicyVersion: number;
    isDemo: true;
    disclaimer: string;
    placeOfSupplyState: string;
    placeOfSupplySource: "delivery_address" | "store_estimate";
    itemRule: {
      ruleId: number;
      ruleVersion: number;
      rateBps: number;
      hsnSacCode: string;
    };
    deliveryRule: {
      ruleId: number;
      ruleVersion: number;
      rateBps: number;
      hsnSacCode: string;
      taxableAmountPaise: number;
      taxPaise: number;
    };
  };
}
```

The ordering of `promotions` is promotion ID ascending. Item allocations are line ID ascending; unit indexes are ascending. These orders are part of the replayable response contract.

### 4.4 Immutable order application and allocation

```ts
interface PromotionApplicationDto {
  id: number;
  promotionId: number;
  orderId: number;
  kind: PromotionKind;
  name: string;
  code: string | null;
  discountType: DiscountType;
  definitionVersion: number;
  status: PromotionApplicationStatus;
  itemDiscountPaise: number;
  deliveryDiscountPaise: number;
  totalSavingsPaise: number;
  standardDeliveryFeePaise: number;
  chargedDeliveryFeePaise: number;
  allocations: PromotionAllocationDto[];
  reservedAt: string | null;
  consumedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PromotionAllocationDto {
  id: number;
  promotionApplicationId: number;
  orderItemId: number | null;
  component: "item" | "delivery";
  unitIndex: number | null;
  amountPaise: number;
}
```

Application identity and display fields always come from immutable snapshots, not a join to the current promotion definition. Item allocations are persisted per stable zero-based unit index so distinct offers may affect different units of one order-item line. A delivery allocation has `orderItemId = null` and `unitIndex = null`.

`(orderId, promotionId)` is unique. An order has at most one reserved or consumed coupon-kind application; automatic-deals mode may have multiple offer-kind applications only when their item unit/delivery allocations do not overlap.

## 5. Bundle DTOs

```ts
interface BundleComponentDto {
  productId: number;
  name: string;
  quantityPerBundle: number;
  isAvailable: boolean;
}

interface QuoteBundleComponentDto extends BundleComponentDto {
  totalQuantity: number;
}

interface BundleProductDto {
  productId: number;
  productType: "bundle";
  name: string;
  description: string | null;
  imageUrl: string;
  storeId: number;
  sellingPricePaise: number;
  compareAtPricePaise: number;
  markdownPaise: number;
  isAvailable: boolean;
  unavailableComponentIds: number[];
  components: BundleComponentDto[];
}

interface OrderItemBundleSnapshotDto {
  orderItemId: number;
  bundleProductId: number;
  bundleName: string;
  sellingUnitPricePaise: number;
  compareAtUnitPricePaise: number;
  markdownPaise: number;
  components: Array<{
    productId: number;
    name: string;
    quantityPerBundle: number;
    totalQuantity: number;
  }>;
}
```

Components order by component product ID ascending. `markdownPaise` is display-only and never a promotion allocation.

## 6. Media upload DTO

The upload request is `multipart/form-data` with exactly:

- `variant`: `desktop | mobile`
- `imageAlt`: trimmed non-empty text within the named maximum
- `file`: one validated image

```ts
interface PromotionMediaUploadResponseDto {
  promotionId: number;
  definitionVersion: number;
  variant: PromotionMediaVariant;
  url: string;
  imageAlt: string;
  replacedUrl: string | null;
}
```

`url` and `replacedUrl` are application URLs, never filesystem paths. A successful upload response reflects committed database truth; deletion of an old unreferenced file is asynchronous cleanup and does not change this DTO.

## 7. Endpoint contract

All paths below are relative to `/api/v1`.

### 7.1 Platform administration

| Method and path | Request | Response `data` | Authorization |
| --- | --- | --- | --- |
| `POST /promotions` | `PromotionDefinitionWriteDto` | `PromotionAdminDto` | `platform.promotions.manage` |
| `GET /promotions` | bounded query filters | paginated `PromotionAdminDto[]` | `platform.promotions.manage` |
| `GET /promotions/:id` | none | `PromotionAdminDto` | `platform.promotions.manage` |
| `PUT /promotions/:id` | full definition plus `expectedDefinitionVersion` | `PromotionAdminDto` | `platform.promotions.manage` |
| `DELETE /promotions/:id` | none | deactivated `PromotionAdminDto` | `platform.promotions.manage` |
| `POST /promotions/:id/images` | multipart media request | `PromotionMediaUploadResponseDto` | `platform.promotions.manage` |
| `DELETE /promotions/:id/images` | `{ "variant": "desktop" \| "mobile" }` | `PromotionAdminDto` | `platform.promotions.manage` |
| `GET /promotions/:id/analytics` | optional date/store filters | `PromotionAnalyticsDto` | `platform.promotions.manage` |

`DELETE` is a soft deactivation and never removes a referenced definition. Reactivation is a full `PUT` with `isActive: true`. Material `PUT`, activation/deactivation, budget, rule, placement, and media changes increment `definitionVersion`. A stale `expectedDefinitionVersion` fails with `PROMOTION_VERSION_CONFLICT`.

Deleting desktop media also clears homepage placement. Alt text remains while either media variant is present. Media removal is idempotent. Creating a featured offer requires three steps: create with placement disabled, upload desktop media with alt text, then enable placement with a version-checked `PUT`.

When an admin list supplies `storeId`, each admin item additionally includes `storeParticipation: { storeId, enabled, effectiveEnabled }`. The global definition remains unchanged. Manager lists use the frozen `EffectiveStorePromotionDto` instead.

```ts
interface PromotionDefinitionWriteDto {
  kind: PromotionKind;
  name: string;
  description: string;
  code: string | null;
  discount: PromotionDiscountDto;
  scope: PromotionScope;
  includeCustomizationValue: boolean;
  eligibility: PromotionAdminDto["eligibility"];
  validity: PromotionAdminDto["validity"];
  limits: PromotionAdminDto["limits"];
  display: Pick<PromotionAdminDto["display"], "priority" | "showOnHomepage">;
  rules: PromotionRuleDto[];
  isActive: boolean;
}

interface PromotionUpdateRequestDto extends PromotionDefinitionWriteDto {
  expectedDefinitionVersion: number;
}

interface PromotionAnalyticsDto {
  promotionId: number;
  fromBusinessDate: string;
  toBusinessDate: string;
  totals: {
    reservedApplications: string;
    consumedApplications: string;
    releasedApplications: string;
    uniqueUsers: string;
    itemDiscountPaise: string;
    deliveryDiscountPaise: string;
    totalSavingsPaise: string;
    influencedOrderValuePaise: string;
    netRevenueReductionPaise: string;
  };
  stores: Array<{
    storeId: number;
    storeName: string;
    consumedApplications: string;
    uniqueUsers: string;
    itemDiscountPaise: string;
    deliveryDiscountPaise: string;
    totalSavingsPaise: string;
    influencedOrderValuePaise: string;
    netRevenueReductionPaise: string;
  }>;
}
```

`netRevenueReductionPaise` is the positive tax-exclusive item contra-revenue magnitude attributable to consumed applications. It excludes delivery savings and bundle markdown. Reserved applications are reported separately and are not revenue.

Analytics query fields are `fromBusinessDate`, `toBusinessDate`, and optional `storeId`. Dates are inclusive and use the order's immutable `pricingBusinessDate`. Omitted dates cover `0001-01-01` through `9999-12-31`. Application counts reflect current lifecycle status; unique users, savings and influenced payable order value include consumed applications only. Global unique users are counted directly, not added across stores. Tax-exclusive line reductions are proportionally attributed across all applications on the line with largest remainders and application-ID tie-breaking before filtering to this promotion. This is application attribution, not a delivered-ledger recognition report; C09 integrates financial reporting.

Admin list filters are `kind`, derived `status`, optional `storeId`, `page`, and `pageSize`. Defaults and maxima are named constants. Response pagination is:

```json
{
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 25,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

### 7.2 Store manager controls

| Method and path | Request | Response `data` | Authorization |
| --- | --- | --- | --- |
| `GET /stores/:storeId/promotions` | bounded filters | paginated `EffectiveStorePromotionDto[]` | same-store `store.promotions.toggle` |
| `PUT /stores/:storeId/promotions/:promotionId/setting` | `{ "enabled": boolean, "reason"?: string }` | `EffectiveStorePromotionDto` | same-store `store.promotions.toggle` |

The setting write is strict. `reason` is trimmed, length-bounded, optional when enabling, and required when disabling. Only the same-store manager changes a store setting; platform admins control the global definition and see participation summaries but do not override a manager's explicit setting.

### 7.3 Customer discovery and validation

| Method and path | Request | Response `data` | Authorization |
| --- | --- | --- | --- |
| `GET /promotions/offers?storeId=:storeId` | positive store ID | `PromotionPublicDto[]` | public |
| `GET /promotions/featured?storeId=:storeId` | positive store ID | `FeaturedPromotionDto[]` | public |
| `POST /promotions/validate` | `{ "couponCode": string }` | `PricingQuoteDto` | authenticated active-cart owner |
| `POST /checkout/quote` | optional `couponCode`, authoritative quote context | `PricingQuoteDto` | public with items/state or authenticated cart/address |

Discovery lists describe currently active, effectively enabled offers for the selected store but do not promise cart/user eligibility. The quote is authoritative. `/promotions/validate` loads the authenticated user's active cart and store; it does not accept item prices, an offer ID, a promotion ID, or a store override.

C05 discovery returns at most `PROMOTION_LIST_MAX_PAGE_SIZE` offers or `HOMEPAGE_FEATURED_OFFER_LIMIT` featured offers. It uses global active dates and occupied capacity/budget, selected-store participation, and stable priority/ID ordering. Store-local day/time and cart/user conditions are advertised in `eligibilitySummary`; discovery does not evaluate a submitted cart. Coupon validation and promotion-aware pricing are integrated in C06/C07.

Pricing policy v4 does not apply the legacy delivery-rule free-delivery threshold to new quotes. A positive standard fee becomes zero only through an applied `free_delivery` offer, so `deliveryDiscountPaise` always reconciles to a promotion allocation and budget. A zero standard fee produces no saving and therefore no promotion application.

Static customer paths (`/offers`, `/featured`, `/validate`) are registered before `/:id`.

### 7.4 Representative wire examples

The TypeScript blocks above are normative shapes. These JSON examples show their wire representation without legacy fields.

Create a product offer:

```json
{
  "kind": "offer",
  "name": "Farmhouse Friday",
  "description": "20% off eligible Farmhouse pizzas.",
  "code": null,
  "discount": {
    "type": "percentage",
    "rateBps": 2000,
    "maxDiscountPaise": 15000
  },
  "scope": "product",
  "includeCustomizationValue": false,
  "eligibility": {
    "minimumOrderPaise": 30000,
    "minimumCartQuantity": 1,
    "firstOrderOnly": false
  },
  "validity": {
    "startsAt": "2026-09-18T00:00:00.000Z",
    "endsAt": "2026-10-01T00:00:00.000Z",
    "activeDaysOfWeek": [5],
    "activeStartTime": null,
    "activeEndTime": null
  },
  "limits": {
    "perUserRedemptions": 2,
    "globalRedemptions": null,
    "budgetPaise": 500000
  },
  "display": {
    "priority": 50,
    "showOnHomepage": false
  },
  "rules": [
    { "type": "product_include", "productId": 11 }
  ],
  "isActive": true
}
```

The resulting admin DTO includes generated and derived fields:

```json
{
  "data": {
    "id": 101,
    "definitionVersion": 1,
    "kind": "offer",
    "name": "Farmhouse Friday",
    "description": "20% off eligible Farmhouse pizzas.",
    "code": null,
    "discount": {
      "type": "percentage",
      "rateBps": 2000,
      "maxDiscountPaise": 15000
    },
    "scope": "product",
    "includeCustomizationValue": false,
    "eligibility": {
      "minimumOrderPaise": 30000,
      "minimumCartQuantity": 1,
      "firstOrderOnly": false
    },
    "validity": {
      "startsAt": "2026-09-18T00:00:00.000Z",
      "endsAt": "2026-10-01T00:00:00.000Z",
      "activeDaysOfWeek": [5],
      "activeStartTime": null,
      "activeEndTime": null
    },
    "limits": {
      "perUserRedemptions": 2,
      "globalRedemptions": null,
      "budgetPaise": 500000
    },
    "display": {
      "priority": 50,
      "showOnHomepage": false,
      "imageUrl": null,
      "mobileImageUrl": null,
      "imageAlt": null
    },
    "rules": [
      { "type": "product_include", "productId": 11 }
    ],
    "isActive": true,
    "status": "scheduled",
    "createdAt": "2026-09-12T10:00:00.000Z",
    "updatedAt": "2026-09-12T10:00:00.000Z"
  }
}
```

An explicit manager opt-out returns the effective setting rather than mutating the definition:

```json
{
  "data": {
    "promotion": {
      "id": 101,
      "definitionVersion": 1,
      "kind": "offer",
      "name": "Farmhouse Friday",
      "description": "20% off eligible Farmhouse pizzas.",
      "code": null,
      "discount": {
        "type": "percentage",
        "rateBps": 2000,
        "maxDiscountPaise": 15000
      },
      "scope": "product",
      "includeCustomizationValue": false,
      "eligibility": {
        "minimumOrderPaise": 30000,
        "minimumCartQuantity": 1,
        "firstOrderOnly": false
      },
      "validity": {
        "startsAt": "2026-09-18T00:00:00.000Z",
        "endsAt": "2026-10-01T00:00:00.000Z",
        "activeDaysOfWeek": [5],
        "activeStartTime": null,
        "activeEndTime": null
      },
      "limits": {
        "perUserRedemptions": 2,
        "globalRedemptions": null,
        "budgetPaise": 500000
      },
      "rules": [
        { "type": "product_include", "productId": 11 }
      ],
      "isActive": true,
      "status": "scheduled"
    },
    "storeId": 2,
    "explicitSetting": {
      "enabled": false,
      "reason": "Local campaign conflict",
      "updatedByUserId": 44,
      "updatedAt": "2026-09-12T10:05:00.000Z"
    },
    "effectiveEnabled": false,
    "effectiveStatus": "store_disabled",
    "canToggle": true
  }
}
```

An immutable consumed application with per-unit allocation is represented as:

```json
{
  "id": 9001,
  "promotionId": 101,
  "orderId": 7001,
  "kind": "offer",
  "name": "Farmhouse Friday",
  "code": null,
  "discountType": "percentage",
  "definitionVersion": 1,
  "status": "consumed",
  "itemDiscountPaise": 8000,
  "deliveryDiscountPaise": 0,
  "totalSavingsPaise": 8000,
  "standardDeliveryFeePaise": 4000,
  "chargedDeliveryFeePaise": 4000,
  "allocations": [
    {
      "id": 9101,
      "promotionApplicationId": 9001,
      "orderItemId": 7101,
      "component": "item",
      "unitIndex": 0,
      "amountPaise": 8000
    }
  ],
  "reservedAt": null,
  "consumedAt": "2026-09-18T12:00:00.000Z",
  "releasedAt": null,
  "createdAt": "2026-09-18T12:00:00.000Z",
  "updatedAt": "2026-09-18T12:00:00.000Z"
}
```

A public bundle DTO keeps merchandising markdown separate from promotion savings:

```json
{
  "productId": 30,
  "productType": "bundle",
  "name": "Pizza + Drink Combo",
  "description": "One pizza and one drink.",
  "imageUrl": "/uploads/products/combo.webp",
  "storeId": 1,
  "sellingPricePaise": 30000,
  "compareAtPricePaise": 36000,
  "markdownPaise": 6000,
  "isAvailable": true,
  "unavailableComponentIds": [],
  "components": [
    {
      "productId": 11,
      "name": "Farmhouse Pizza",
      "quantityPerBundle": 1,
      "isAvailable": true
    },
    {
      "productId": 20,
      "name": "Cola",
      "quantityPerBundle": 1,
      "isAvailable": true
    }
  ]
}
```

A committed desktop upload returns:

```json
{
  "data": {
    "promotionId": 101,
    "definitionVersion": 2,
    "variant": "desktop",
    "url": "/uploads/promotions/01k5-example.webp",
    "imageAlt": "Farmhouse pizza promotion",
    "replacedUrl": null
  }
}
```

## 8. Stable error codes

| Code | HTTP | Meaning and safe response policy |
| --- | ---: | --- |
| `PROMOTION_NOT_FOUND` | 404 | Requested admin ID or directly submitted coupon code has no definition. Never used to enumerate codes. |
| `PROMOTION_INELIGIBLE` | 422 | Definition exists but cart/user/date/target/minimum rules are not satisfied; `data.reasonCode` uses the eligibility reason dictionary below. |
| `PROMOTION_NOT_ACTIVE` | 409 | Definition is globally inactive, scheduled, or expired for a direct authorized operation. |
| `PROMOTION_DISABLED_FOR_STORE` | 409 | Promotion is explicitly disabled for a new quote/order at the selected store. |
| `PROMOTION_CAPACITY_EXHAUSTED` | 409 | Global or per-user reserved-plus-consumed limit has no capacity. |
| `PROMOTION_BUDGET_EXHAUSTED` | 409 | Remaining global budget cannot cover the exact application. |
| `PROMOTION_VERSION_CONFLICT` | 409 | Admin update used a stale `expectedDefinitionVersion`. |
| `COUPON_NOT_COMBINABLE_WITH_OFFERS` | 409 | An offer or deal bundle blocks the submitted coupon; includes `couponEligibility`. |
| `PROMOTION_INVALID_DEFINITION` | 400 | Strict shape or cross-field/rule matrix is invalid. |
| `PROMOTION_MEDIA_INVALID` | 400 | Decoded image format, MIME, size, dimensions, or variant is invalid. |
| `PROMOTION_MEDIA_REQUIRED_FOR_HOMEPAGE` | 400 | Homepage placement lacks desktop media or useful alt text. |
| `PROMOTION_MEDIA_STORAGE_FAILED` | 500 | Valid upload could not be durably stored; no raw path is returned. |
| `STORE_PROMOTION_REASON_REQUIRED` | 400 | A disable request omitted its bounded audit reason. |
| `PERMISSION_DENIED` | 403 | Authenticated actor lacks the required global capability or same-store permission. |
| `CART_EMPTY` | 400 | Coupon validation has no active non-empty cart. |

Eligibility reason codes inside `PROMOTION_INELIGIBLE` are stable:

```ts
type PromotionIneligibilityReasonCode =
  | "DATE_RESTRICTED"
  | "DAY_RESTRICTED"
  | "TIME_RESTRICTED"
  | "AUTHENTICATION_REQUIRED"
  | "FIRST_ORDER_REQUIRED"
  | "PER_USER_LIMIT_REACHED"
  | "MINIMUM_ORDER_NOT_MET"
  | "MINIMUM_QUANTITY_NOT_MET"
  | "PRODUCT_TARGET_NOT_PRESENT"
  | "CATEGORY_TARGET_NOT_PRESENT";
```

Messages are presentation text and are not stable. Frontends branch only on `code` and nested `reasonCode`.

Example conflict response:

```json
{
  "message": "Coupons cannot be used with automatic deals.",
  "code": "COUPON_NOT_COMBINABLE_WITH_OFFERS",
  "data": {
    "couponEligibility": {
      "eligible": false,
      "reasonCode": "OFFER_APPLIED",
      "conflictingLineIds": [1, 2]
    }
  }
}
```

## 9. Permission matrix

| Operation | Platform admin | Same-store manager | Finance manager | Payroll manager | Operator | Inventory staff | Customer/anonymous |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create/edit/activate/deactivate promotion | `platform.promotions.manage` | No | No | No | No | No | No |
| Change rules, schedule, limits, or global budget | `platform.promotions.manage` | No | No | No | No | No | No |
| Upload/replace/remove promotion media | `platform.promotions.manage` | No | No | No | No | No | No |
| Read global definitions and analytics | `platform.promotions.manage` | No | No | No | No | No | No |
| Read effective definitions through store-management endpoint | No (admin list supplies participation summary) | `store.promotions.toggle`, own store only | No | No | No | No | No |
| Disable/re-enable store participation | No | `store.promotions.toggle`, own store only | No | No | No | No | No |
| Browse public offers/featured media | Yes | Yes | Yes | Yes | Yes | Yes | Public |
| Validate a coupon against owned cart | Yes as customer flow | Yes as customer flow | Yes as customer flow | Yes as customer flow | Yes as customer flow | Yes as customer flow | Authenticated user only |

Platform admins receive `platform.promotions.manage`. Only the `manager` store role receives `store.promotions.toggle`. Frontend route guards and hidden controls are UX only; every backend request rechecks the current principal, active membership, active store, requested `storeId`, and capability/permission.

Successful and denied definition, media, budget, activation, and store-setting writes are audited with actor, store ID where relevant, promotion ID/version, before/after state, optional reason, outcome, and correlation metadata. Coupon codes and raw file bytes are excluded from failure audit payloads.

Audit identifiers are also frozen:

```ts
type PromotionAuditAction =
  | "promotion.created"
  | "promotion.updated"
  | "promotion.deactivated"
  | "promotion.reactivated"
  | "promotion.media_uploaded"
  | "promotion.media_removed"
  | "store_promotion_setting.updated";

type PromotionAuditResourceType = "promotion" | "store_promotion_setting";

type PromotionHighRiskOperation =
  | "promotion.create"
  | "promotion.update"
  | "promotion.deactivate"
  | "promotion.reactivate"
  | "promotion.media_upload"
  | "promotion.media_remove"
  | "promotion.store_setting_update";
```

Denied/failed attempt actions append the existing `.denied` or `.failed` suffix to `PromotionHighRiskOperation`. Definition/media records use resource type `promotion`; manager participation writes use `store_promotion_setting` with the promotion ID and store ID in structured metadata.

## 10. Reconciled quote example

This automatic-deal quote has a 5,000 paise item offer, a 4,000 paise free-delivery offer, and a bundle with 6,000 paise display markdown:

```json
{
  "data": {
    "quoteVersion": "2026-09-12-03",
    "currency": "INR",
    "pricingPolicyVersion": 4,
    "discountMode": "automatic_deals",
    "itemsSubtotalPaise": 75000,
    "itemDiscountPaise": 5000,
    "standardDeliveryFeePaise": 4000,
    "chargedDeliveryFeePaise": 0,
    "deliveryDiscountPaise": 4000,
    "promotionSavingsPaise": 9000,
    "bundleMarkdownPaise": 6000,
    "totalDisplayedSavingsPaise": 15000,
    "roundingAdjustmentPaise": 0,
    "grandTotalPaise": 70000,
    "taxableAmountPaise": 66666,
    "taxPaise": 3334,
    "couponEligibility": {
      "eligible": false,
      "reasonCode": "OFFER_APPLIED",
      "conflictingLineIds": [1, 2]
    },
    "promotions": [
      {
        "id": 101,
        "definitionVersion": 2,
        "kind": "offer",
        "name": "₹50 off featured pizza",
        "code": null,
        "discountType": "fixed_amount",
        "itemDiscountPaise": 5000,
        "deliveryDiscountPaise": 0,
        "totalSavingsPaise": 5000,
        "applied": true,
        "allocations": [
          {
            "lineId": 1,
            "component": "item",
            "unitIndexes": [0],
            "amountPaise": 5000
          }
        ]
      },
      {
        "id": 102,
        "definitionVersion": 1,
        "kind": "offer",
        "name": "Free delivery",
        "code": null,
        "discountType": "free_delivery",
        "itemDiscountPaise": 0,
        "deliveryDiscountPaise": 4000,
        "totalSavingsPaise": 4000,
        "applied": true,
        "allocations": [
          {
            "lineId": null,
            "component": "delivery",
            "unitIndexes": [],
            "amountPaise": 4000
          }
        ]
      }
    ],
    "items": [
      {
        "lineId": 1,
        "productId": 11,
        "productName": "Farmhouse Pizza",
        "productType": "single",
        "quantity": 1,
        "baseUnitPricePaise": 40000,
        "customizationUnitPricePaise": 5000,
        "unitPricePaise": 45000,
        "compareAtUnitPricePaise": null,
        "lineSubtotalPaise": 45000,
        "itemDiscountPaise": 5000,
        "bundleMarkdownPaise": 0,
        "lineTotalPaise": 40000,
        "taxableAmountPaise": 38095,
        "taxPaise": 1905,
        "taxRateBps": 500,
        "hsnSacCode": "21069099-DEMO",
        "customizations": [
          {
            "customizationOptionId": 7,
            "name": "Extra cheese",
            "pricePaise": 5000
          }
        ],
        "bundleComponents": []
      },
      {
        "lineId": 2,
        "productId": 30,
        "productName": "Pizza + Drink Combo",
        "productType": "bundle",
        "quantity": 1,
        "baseUnitPricePaise": 30000,
        "customizationUnitPricePaise": 0,
        "unitPricePaise": 30000,
        "compareAtUnitPricePaise": 36000,
        "lineSubtotalPaise": 30000,
        "itemDiscountPaise": 0,
        "bundleMarkdownPaise": 6000,
        "lineTotalPaise": 30000,
        "taxableAmountPaise": 28571,
        "taxPaise": 1429,
        "taxRateBps": 500,
        "hsnSacCode": "21069099-DEMO",
        "customizations": [],
        "bundleComponents": [
          {
            "productId": 11,
            "name": "Farmhouse Pizza",
            "quantityPerBundle": 1,
            "totalQuantity": 1,
            "isAvailable": true
          },
          {
            "productId": 20,
            "name": "Cola",
            "quantityPerBundle": 1,
            "totalQuantity": 1,
            "isAvailable": true
          }
        ]
      }
    ],
    "deliveryPricing": {
      "ruleId": 4,
      "ruleVersion": 1,
      "storeId": 1,
      "businessDate": "2026-09-12",
      "timezone": "Asia/Kolkata",
      "standardFeePaise": 4000,
      "chargedFeePaise": 0
    },
    "tax": {
      "calculationPolicyVersion": 1,
      "isDemo": true,
      "disclaimer": "Portfolio demo — not a statutory tax invoice",
      "placeOfSupplyState": "Karnataka",
      "placeOfSupplySource": "delivery_address",
      "itemRule": {
        "ruleId": 21,
        "ruleVersion": 2,
        "rateBps": 500,
        "hsnSacCode": "21069099-DEMO"
      },
      "deliveryRule": {
        "ruleId": 22,
        "ruleVersion": 2,
        "rateBps": 1800,
        "hsnSacCode": "996813-DEMO",
        "taxableAmountPaise": 0,
        "taxPaise": 0
      }
    }
  }
}
```

The arithmetic is exact:

```text
itemDiscountPaise           = 5,000
deliveryDiscountPaise       = 4,000 - 0 = 4,000
promotionSavingsPaise       = 5,000 + 4,000 = 9,000
bundleMarkdownPaise         = 36,000 - 30,000 = 6,000
totalDisplayedSavingsPaise  = 9,000 + 6,000 = 15,000
grandTotalPaise             = 75,000 - 5,000 + 0 + 0 = 70,000
taxableAmountPaise + taxPaise = 66,666 + 3,334 = 70,000
```

If a coupon code accompanies this cart, the request fails with `COUPON_NOT_COMBINABLE_WITH_OFFERS`; this successful quote is not silently repriced into coupon mode.

## 11. Contract acceptance checklist

- `DiscountMode` and kind/type/scope matrices are closed and shared by backend/frontend.
- Public and featured DTOs cannot represent a coupon or code.
- Store effective state distinguishes absent/default-enabled, explicit disabled, and globally inactive.
- Quote, bundle, promotion, delivery, and displayed savings reconcile without double subtraction.
- Application and allocation DTOs are immutable, collection-based, and payment-lifecycle capable.
- Upload responses expose URLs, not storage paths, and follow ADR-008 replacement semantics.
- Error codes cover exclusivity, eligibility, store disablement, capacity, budget, version, rules, media, and authorization.
- Permission checks distinguish platform definition ownership from same-store manager opt-out.
- C03, C05, C06, C11, C12, and C13 implement against this document without inventing alternate response shapes.
