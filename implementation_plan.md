# Promotions & Offers Overhaul — Dominos-Style System

Full overhaul of the promotion system into two distinct concepts: **Offers** (admin-configured product/category deals whose advertised price is applied automatically) and **Coupons** (codes that a customer must enter manually and that are never auto-applied). Replaces the existing legacy coupon tables and integrates into the PricingService for tax-correct inclusive pricing.

## User Review Required

> [!IMPORTANT]
> **Fresh database only.** Per data policy, this overhaul targets fresh databases. The existing `coupons` and `coupon_redemptions` tables will be dropped and replaced by new `promotions`, `promotion_rules`, and `promotion_redemptions` tables. No migration of existing coupon data.

> [!WARNING]
> **PricingService v2.** The existing `buildQuote()` will be significantly reworked to resolve automatic offers and an optional manually entered coupon from authoritative cart/store data. The `QUOTE_VERSION` and `PRICING_POLICY_VERSION` will be bumped. All existing checkout/pricing tests will need updating.

> [!IMPORTANT]
> **Scope is large.** This touches schema, pricing, checkout, COD and Razorpay lifecycles, payment recovery, order snapshots, authorization/audit, system reset, finance fixtures, admin/customer UI, documentation, seeds, and tests. Keep one coordinated release if desired, but implement it as reviewable vertical slices. Repository cross-verification suggests roughly 55-75 files may be touched or created rather than 30-40.

## Confirmed Product Decisions

> [!IMPORTANT]
> **No offer/coupon stacking.** Coupons are always entered manually and are never auto-applied. Product/category offers are reflected automatically and retain their advertised deal price. If any cart line receives an offer—or the cart contains a pre-built deal combo—the whole cart is coupon-ineligible. Return a clear `COUPON_NOT_COMBINABLE_WITH_OFFERS` response rather than silently changing an offered item's price.

> [!IMPORTANT]
> **Pre-built combos.** Combos are first-class catalogue bundle products, not a rule that searches for separately added cart items. Show the regular/compare-at price beside the lower bundle selling price, like a Domino's combo card. Customers add the bundle as one cart line; its components remain available for display and inventory allocation.

> [!IMPORTANT]
> **Promotion media.** Offers/promotions support admin image uploads using the existing Multer foundation. Selected active offers can also appear in a responsive homepage slider controlled by an explicit homepage placement flag and display priority.

> [!NOTE]
> **First-order and accounting policy.** Cancelled orders and failed payment attempts do not consume first-order eligibility. Free delivery is recorded as zero delivery revenue plus `deliveryDiscountPaise` for customer/marketing analytics; it is not posted as account `4100` contra-revenue.

> [!IMPORTANT]
> **Platform ownership with store opt-out.** Promotions are platform-wide definitions owned by platform admins. Only platform admins can create, edit, schedule, activate/deactivate, upload media, or change budgets/rules. Every active promotion is enabled for every store by default. A store's `manager` (the highest store role) may disable or re-enable it for that store, but cannot alter its definition. Store choices are audited.

> [!IMPORTANT]
> **Revenue treatment.** Item offers and coupons reduce the fulfilling store's recognized revenue through the existing discount contra-revenue path. Platform financial views consolidate store ledgers, so consolidated platform revenue falls automatically and the discount is never deducted twice. Pre-built combo compare-at savings are merchandising metadata: only the bundle selling price is recognized as revenue.

---

## Domain Model

Two top-level concepts backed by a unified `promotions` table with a discriminated `kind` field:

### Offer vs Coupon

| Aspect | Offer | Coupon |
|---|---|---|
| **Discovery** | Browsable offers page/home slider; automatically reflected when eligible | Manual code entry; never auto-applied |
| **Code** | None | Required, unique |
| **Scope** | Product-level, category-level, or cart-level | Cart-level only |
| **Combinability** | Never combines with a coupon | Rejected when any offer/deal combo is present |
| **Stacking** | Multiple offers may affect distinct lines; best single offer wins per line/unit | At most one coupon, and only on an offer-free cart |
| **Visibility** | Public (shown to all eligible users) | Hidden until code entered |

An order uses one exclusive discount mode: `none`, `automatic_deals`, or `coupon`. Automatic deals include product/category offers and pre-built deal bundles. Keep a promotion collection because several offers may affect different lines, but never persist offer-kind and coupon-kind applications on the same order.

### Discount Types

| Type | Applies to | Example |
|---|---|---|
| `percentage` | Cart or specific items | 20% off on all pizzas |
| `fixed_amount` | Cart or specific items | ₹100 off on Margherita |
| `buy_x_get_y` | Specific products/categories | Buy 2 pizzas, cheapest free |
| `free_delivery` | Delivery fee | Free delivery on orders above ₹499 |
| `tiered` | Cart total | Spend ₹500 → 10% off, ₹1000 → 20% off |

Combo pricing is deliberately not a promotion discount type. It is represented by a pre-built bundle product with component rows and a regular/compare-at price versus selling price.

### Targeting & Eligibility Rules

All promotions can optionally have these constraints:

- **Product restrictions** — only applies to specific product IDs
- **Category restrictions** — only applies to items in specific categories
- **Store availability** — platform-wide by default; an individual store manager may opt that store out
- **Per-user limit** — max N uses per user
- **First-order-only** — only for users with zero previous orders
- **Time-of-day** — active only between HH:MM and HH:MM
- **Day-of-week** — active only on specific days (Mon, Tue, etc.)
- **Min order value** — minimum cart subtotal in paise
- **Min cart quantity** — minimum number of items
- **Date range** — start/end dates (already exists in current system)
- **Max redemptions** — global cap (already exists)
- **Max discount cap** — e.g., 20% off but capped at ₹200
- **Budget limit** — one platform-wide discount budget across all participating stores; auto-deactivate when exhausted

---

## Proposed Changes

### Database Schema (Backend)

#### [NEW] [promotion.schema.ts](file:///F:/Shreyas/food/backend/src/db/schema/promotion.schema.ts)

The core promotions table, replacing `couponsTable`:

```
promotions
├── id (serial PK)
├── kind: 'offer' | 'coupon'
├── name: text (admin-facing display name)
├── description: text (customer-facing)
├── code: text (unique, nullable — required for coupons, forbidden for offers)
├── discount_type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'free_delivery' | 'tiered'
├── discount_rate_bps: integer (for percentage)
├── discount_amount_paise: integer (for fixed_amount)
├── max_discount_paise: integer (cap for percentage discounts)
├── minimum_order_paise: integer (default 0)
├── minimum_cart_quantity: integer (default 0)
├── scope: 'cart' | 'product' | 'category' | 'delivery'
├── definition_version: integer (starts at 1; increment on material edits)
├── first_order_only: boolean (default false)
├── per_user_limit: integer (default -1, unlimited)
├── active_start_time: time (nullable, for time-of-day restriction)
├── active_end_time: time (nullable)
├── active_days_of_week: integer[] (nullable, 0=Sun..6=Sat)
├── start_date: timestamptz
├── end_date: timestamptz
├── is_active: boolean
├── redemption_count: integer (default 0)
├── max_redemptions: integer (default -1)
├── total_discount_budget_paise: integer (nullable, auto-deactivate when spent)
├── total_discount_spent_paise: integer (default 0)
├── display_priority: integer (default 0, for ordering on offers page)
├── image_url: text (nullable)
├── mobile_image_url: text (nullable)
├── image_alt: text (required when an image is present)
├── show_on_homepage: boolean (default false; offer-kind only)
├── created_at, updated_at
```

#### [NEW] `store-promotion-setting.schema.ts`

Promotions are platform-wide; stores have opt-out settings rather than promotion targeting:

```text
store_promotion_settings
├── id
├── promotion_id: FK → promotions
├── store_id: FK → stores
├── is_enabled: boolean (default true)
├── updated_by_user_id: FK → users
├── disabled_reason: text nullable
├── created_at, updated_at
└── unique(promotion_id, store_id)
```

Absence of a row means enabled, so new promotions and new stores participate by default. The store manager toggle upserts the explicit setting. Checkout evaluates `coalesce(setting.is_enabled, true)`. It locks the promotion and store rows during final resolution so a concurrent opt-out cannot create an ambiguous order snapshot.

Check constraints:
- `discount_value_matches_type` — same pattern as current but extended for all types
- `kind_code_consistency` — coupons MUST have a code; offers MUST NOT have one
- `scope_matches_type` — free_delivery must be scope 'delivery'
- `max_discount_only_for_percentage` — max_discount_paise only set when discount_type is percentage
- `budget_tracking_consistent` — spent <= budget when budget is set
- `time_range_valid` — start_time < end_time when both set

#### [NEW] [promotion-rule.schema.ts](file:///F:/Shreyas/food/backend/src/db/schema/promotion-rule.schema.ts)

For product/category targeting and BXGY/tiered rules:

```
promotion_rules
├── id (serial PK)
├── promotion_id: integer FK → promotions
├── rule_type: 'product_include' | 'category_include' | 'bxgy_buy' | 'bxgy_get' | 'tier'
├── product_id: integer FK nullable → products
├── category_id: integer FK nullable → categories
├── quantity: integer (for BXGY: how many to buy/get)
├── tier_min_paise: integer (for tiered: threshold)
├── tier_discount_rate_bps: integer (for tiered: rate at this tier)
├── tier_discount_amount_paise: integer (for tiered: fixed amount at this tier)
├── created_at
```

This normalized approach lets one promotion have:
- Multiple product includes (promotion applies to product 1, 5, 12)
- Multiple category includes (promotion applies to Pizzas, Sides)
- BXGY rules: `bxgy_buy` rows define what to buy, `bxgy_get` rows define what's free
- Tiers: each `tier` row defines a spending threshold and its discount

#### [NEW] `bundle-component.schema.ts` and [MODIFY] catalogue/store-product schemas

Pre-built combos are catalogue products rather than promotion rules:

```text
products
└── product_type: 'single' | 'bundle'

bundle_components
├── id
├── bundle_product_id: FK → products
├── component_product_id: FK → products
├── quantity: positive integer
└── unique(bundle_product_id, component_product_id)

store_products
└── compare_at_price_paise: integer nullable
```

For a bundle, `store_products.price_paise` is the authoritative deal/selling price and `compare_at_price_paise` is the displayed regular price. Require compare-at price to be greater than selling price. A bundle is added as one cart/order line, while component rows drive its contents display and inventory validation/allocation. Prevent nested bundles in service validation. Bundle customizations, if introduced later, are charged separately and never reduce the fixed bundle price.

Add immutable `order_item_bundle_components` snapshots (`order_item_id`, component product ID, component name, quantity per bundle, total quantity) so order history does not change when a bundle definition changes. At checkout, expand bundle quantities into component demand, aggregate that demand with standalone products, and reuse the existing deterministic store-product lock order. Bundle availability is derived from all component availability/stock; bundle SKUs themselves should not maintain an independent on-hand pool.

#### [NEW] [promotion-redemption.schema.ts](file:///F:/Shreyas/food/backend/src/db/schema/promotion-redemption.schema.ts)

Replaces `coupon_redemptions`:

```
promotion_redemptions
├── id (serial PK)
├── promotion_id: integer FK → promotions
├── order_id: integer FK → orders
├── user_id: integer FK → users
├── promotion_kind/name/code/discount_type: immutable snapshots
├── definition_version: integer snapshot
├── status: 'reserved' | 'consumed' | 'released'
├── item_discount_paise: integer
├── delivery_discount_paise: integer
├── total_savings_paise: integer
├── reserved_at: timestamptz
├── consumed_at: timestamptz nullable
├── released_at: timestamptz nullable
├── created_at, updated_at
```

Constraints/indexes: `unique(order_id, promotion_id)` plus a partial unique index enforcing at most one active/reserved coupon per order. Multiple offers may exist only when they affect distinct lines/units; allocation uniqueness and service validation prevent two offers from discounting the same unit. Exact amount snapshots support budget tracking, order history, and analytics.

#### [NEW] `promotion-discount-allocation.schema.ts`

Stores the explainable breakdown per promotion application: promotion redemption/application ID, nullable order item ID, component (`item` or `delivery`), and allocated paise.

#### [DELETE] [coupon.schema.ts](file:///F:/Shreyas/food/backend/src/db/schema/coupon.schema.ts)
#### [DELETE] [coupon-redemption.schema.ts](file:///F:/Shreyas/food/backend/src/db/schema/coupon-redemption.schema.ts)

Removed. The `promotions` table absorbs all coupon functionality.

#### [MODIFY] [order.schema.ts](file:///F:/Shreyas/food/backend/src/db/schema/order.schema.ts)

- Remove `couponId`; do not add a singular `promotionId` because distinct cart lines may receive different automatic offers.
- Add `discountMode: 'none' | 'automatic_deals' | 'coupon'` as an immutable order snapshot. Service validation must prevent mixed offer/coupon application rows.
- Keep aggregate order money fields. Promotion identity, definition, kind/name/code, status, and amount snapshots live in the order's promotion redemption/application rows.

#### [MODIFY] [index.ts](file:///F:/Shreyas/food/backend/src/db/schema/index.ts)

Update exports: remove coupon/coupon-redemption; add promotion, store-promotion-setting, promotion-rule, promotion-redemption, promotion-discount-allocation, and bundle-component schemas.

#### [MODIFY] [_relations.ts](file:///F:/Shreyas/food/backend/src/db/schema/_relations.ts)

Rewrite coupon relations → promotion relations. Add promotion rules/store settings one-to-many and order promotion redemptions/applications one-to-many.

---

### Promotions Engine (Backend)

#### [NEW] [promotions/promotion.types.ts](file:///F:/Shreyas/food/backend/src/features/promotions/promotion.types.ts)

Type definitions: `PromotionKind`, `DiscountType`, `PromotionScope`, `RuleType`, `PromotionRecord`, `ResolvedPromotion`.

#### [NEW] [promotions/promotion.schemas.ts](file:///F:/Shreyas/food/backend/src/features/promotions/promotion.schemas.ts)

Zod schemas for create/update promotion, including nested rules validation.

#### [NEW] [promotions/promotion.service.ts](file:///F:/Shreyas/food/backend/src/features/promotions/promotion.service.ts)

Admin CRUD service:
- `createPromotion(data)` — create promotion + rules in a transaction
- `updatePromotion(id, data)` — update promotion + sync rules
- `deletePromotion(id)` — soft-delete (set isActive = false)
- `uploadPromotionImage(id, file, variant)` — validate and attach desktop/mobile media using randomized filenames
- `getPromotions(filters)` — list with pagination, filter by kind/status and optional effective state for a selected store
- `getPromotionById(id)` — with rules eagerly loaded
- `getPromotionAnalytics(id)` — platform totals plus per-store redemption, exact discount, influenced order value, net-revenue impact, and unique users
- `setStorePromotionEnabled({ storeId, promotionId, enabled, actor })` — manager-only store opt-out/re-enable; never mutates the global definition

#### [NEW] [promotions/promotion.logic.ts](file:///F:/Shreyas/food/backend/src/features/promotions/promotion.logic.ts)

Pure domain logic — the **promotion engine**:

- `evaluateEligibility(promotion, context)` — checks all targeting rules (store, date, time, day, first-order, per-user, min-order, min-quantity, product/category match, budget, max-redemptions)
- `calculateDiscount(promotion, items)` — computes discount paise for each type:
  - **percentage**: deterministic integer calculation `subtotal × bps / 10_000`, capped by `maxDiscountPaise`
  - **fixed_amount**: flat paise amount, capped by subtotal
  - **buy_x_get_y**: identify qualifying items, find cheapest eligible "get" item, its price is the discount
  - **free_delivery**: discount = delivery fee paise
  - **tiered**: find the highest qualifying tier, apply its rate/amount
- `findBestOffersByUnit(eligibleOffers, items)` — select the highest-saving automatic offer for each eligible line/unit with deterministic priority/ID tie-breaking; a unit is discounted at most once
- `resolvePromotionSet({ couponCode? }, context)` — resolve automatic offers first; when any offer or pre-built deal combo is present, reject a supplied coupon. Otherwise validate and apply the one manually entered coupon

#### [NEW] [promotions/promotion.routes.ts](file:///F:/Shreyas/food/backend/src/features/promotions/promotion.routes.ts)

Platform-admin routes:
- `POST /promotions` — create
- `GET /promotions` — list (filterable by kind and active status, with per-store participation summary)
- `GET /promotions/:id` — get with rules
- `PUT /promotions/:id` — update
- `DELETE /promotions/:id` — deactivate
- `POST /promotions/:id/images` — admin-only multipart desktop/mobile image upload
- `GET /promotions/:id/analytics` — redemption stats

Store-manager routes:
- `GET /stores/:storeId/promotions` — read-only global promotion definitions plus effective enabled/disabled state for that store
- `PUT /stores/:storeId/promotions/:promotionId/setting` — body `{ enabled, reason? }`; requires `store.promotions.toggle` for the same store

Customer routes:
- `GET /promotions/offers` — list active, visible offers enabled for the selected store (with eligibility pre-check based on cart/store)
- `GET /promotions/featured` — active `showOnHomepage` offers for the selected store, ordered by display priority
- `POST /promotions/validate` — validate a coupon code against current cart (replaces `POST /coupon/validate`)

Image uploads reuse the existing Multer foundation but require promotion-specific MIME allowlisting, byte/dimension limits, randomized filenames, alt text, and desktop/mobile variants. Update the database only after a successful write; delete replaced files after commit, and document orphan cleanup because filesystem and PostgreSQL changes are not atomic.

#### [NEW] [promotions/promotion.test.ts](file:///F:/Shreyas/food/backend/src/features/promotions/promotion.test.ts)

Unit tests for the logic layer:
- Eligibility checks for every targeting rule
- Discount calculation for every discount type
- Best-promotion selection
- Edge cases: expired, budget-exhausted, first-order, per-user limits, time-of-day
- BXGY cheapest-item-free logic
- Tiered discount threshold boundaries
- Pre-built bundle catalogue/pricing and component inventory behavior

---

### Pricing Integration (Backend)

#### [MODIFY] [pricing.service.ts](file:///F:/Shreyas/food/backend/src/features/pricing/pricing.service.ts)

Major changes:
- Replace `getApplicableCoupon()` with collection-based resolution that derives automatic offers from cart/store data and accepts only an optional manually entered coupon code
- Resolve applicable product/category/cart offers automatically from authoritative data. A coupon remains an optional manual input only and is rejected when an offer/deal bundle exists in the cart
- Replace `calculateDiscountPaise()` with a call to `promotion.logic.calculateDiscount()`
- For BXGY: the discount allocation will target the specific free item's line
- For free_delivery: discount sets `deliveryFeePaise = 0` but through the promotion system, not the free-delivery-threshold
- For pre-built combos: use the bundle's authoritative store selling price as its normal line price; `compareAtPricePaise` is display/savings metadata, not an additional promotion discount
- For tiered: select the correct tier based on subtotal, then apply like percentage/fixed
- Bump `QUOTE_VERSION` and `PRICING_POLICY_VERSION`
- Replace `PricingQuote.coupon` with separated savings totals and a promotion collection:

```ts
discountMode: 'none' | 'automatic_deals' | 'coupon';
itemDiscountPaise: number;
deliveryDiscountPaise: number;
promotionSavingsPaise: number;
bundleMarkdownPaise: number;      // compare-at minus selling price; display only
totalDisplayedSavingsPaise: number;
couponEligibility: {
  eligible: boolean;
  reasonCode: 'OFFER_APPLIED' | 'DEAL_BUNDLE_PRESENT' | null;
  conflictingLineIds: number[];
};
promotions: Array<{
  id: number;
  kind: 'offer' | 'coupon';
  name: string;
  code: string | null;
  discountType: DiscountType;
  itemDiscountPaise: number;
  deliveryDiscountPaise: number;
  totalSavingsPaise: number;
  applied: true;
}>;
```

- Update `PricingRepository` to replace `findCoupon`/`countActiveCouponUses` with `findPromotion`/`countActivePromotionUses`/`countUserPromotionUses`/`countUserOrders`

#### [MODIFY] [pricing.service.test.ts](file:///F:/Shreyas/food/backend/src/features/pricing/pricing.service.test.ts)

Rewrite coupon-related tests → promotion-based tests. Add tests for each new discount type flowing through the pricing engine.

---

### Checkout Integration (Backend)

#### [MODIFY] [checkout.service.ts](file:///F:/Shreyas/food/backend/src/features/checkout/checkout.service.ts)

- `buildQuote()`: accept only an optional manual `couponCode`; resolve automatic offers internally and return either one-or-more offer applications or one coupon application, never both
- `previewCoupon()` → `evaluatePromotions()` — authoritative cart/store evaluation used by quote and validation flows
- Replace singular record/release/consume/restore helpers with idempotent collection-based promotion application lifecycle operations
- Snapshot item, delivery, and total savings on each redemption/application for budget accounting
- Reserve budget/capacity at order hold creation; consume or release it through the existing COD/Razorpay lifecycle while holding promotion row locks

#### [MODIFY] [checkout.service.test.ts](file:///F:/Shreyas/food/backend/src/features/checkout/checkout.service.test.ts)

Update all coupon-related test cases to use the new promotion system.

#### [MODIFY] [checkout.routes.ts](file:///F:/Shreyas/food/backend/src/features/checkout/checkout.routes.ts)

Continue accepting only optional `couponCode` in quote, COD, and Razorpay initiation request bodies. Offers are never selected by client-supplied IDs during checkout; they are resolved from the cart by the server.

---

### Financial and Revenue Integration (Backend)

Promotions change authoritative order/ledger amounts; they are not UI-only savings labels.

- **Item offers and coupons:** Keep the normal pre-discount selling amount in the order/item subtotal snapshot, allocate the exact discount to item lines, recompute inclusive tax on each post-discount line total, and carry the aggregate as `orders.discount_paise`.
- **Revenue recognition:** When a delivered-order financial event is posted, credit normal pre-discount food revenue to account `4000` and debit the actual item offer/coupon amount to discount contra-revenue account `4100`. The net result reduces recognized revenue for the fulfilling `store_id`.
- **Platform reporting:** The current platform view is a consolidation of store-scoped ledgers, not a second revenue owner. Consolidated platform recognized revenue is the sum of the already-discounted store results. Do not subtract promotion spend again at platform level.
- **Pre-built combos:** Recognize only the bundle's authoritative selling price. `compare_at_price_paise - price_paise` is customer-facing merchandising savings and is not account `4100` discount because the compare-at amount was never charged/booked.
- **Free delivery:** Recognize zero delivery revenue, record `delivery_discount_paise` for promotion/budget analytics, and do not create a `4100` line for the waived fee.
- **Timing:** Reserved promotions affect capacity/budget availability but do not create revenue or ledger entries. Recognition remains tied to the existing delivered-order event; cancelled/failed orders recognize nothing.
- **Refunds:** Refund and tax-reversal allocations use the paid, post-discount order snapshots. Never refund or reverse a combo compare-at amount.
- **Attribution:** Promotion analytics provide platform totals plus per-store redemption, discount, influenced order value, and net-revenue impact. The promotion budget is global across enabled stores.

This plan assumes company-operated stores under one PizzaStore entity. It deliberately does not model marketplace commission or a platform subsidy payable to independently owned stores. If franchise funding is added later, introduce an explicit funding source/allocation and intercompany receivable/payable policy rather than changing historical discount semantics.

Required characterization updates include delivered-order event payloads, `commerce-posting.policy`, finance report projections, dashboards that expose order-flow/GOV measures, refunds, deterministic financial fixtures, and related tests.

---

### Legacy Coupon Feature Removal (Backend)

#### [DELETE] [coupon/](file:///F:/Shreyas/food/backend/src/features/coupon)

Entire directory removed. All functionality absorbed by the promotions feature.

---

### Order Feature Updates (Backend)

#### [MODIFY] [order.routes.ts](file:///F:/Shreyas/food/backend/src/features/order) / [order.service.ts](file:///F:/Shreyas/food/backend/src/features/order)

- Update order response mapping to include `promotions[]` from immutable redemption/application snapshots
- Update order queries to join on `promotions` instead of `coupons`

---

### Frontend — Promotions Admin

#### [NEW] [frontend/src/features/promotions/](file:///F:/Shreyas/food/frontend/src/features/promotions)

Full admin feature module:

```
promotions/
├── api/
│   ├── promotion.queries.ts    — usePromotions(), usePromotion(id), usePromotionAnalytics(id)
│   └── promotion.mutations.ts  — useCreatePromotion(), useUpdatePromotion(), useDeletePromotion()
├── model/
│   ├── promotion.types.ts      — TS types mirroring backend
│   └── promotion.keys.ts       — TanStack Query keys
├── components/
│   ├── promotion-form.tsx       — Rich form: kind selector, discount type, rules builder, scheduling, image/alt text, homepage placement
│   ├── promotion-image-upload.tsx — Desktop/mobile preview, validation, upload, and replacement state
│   ├── promotion-table.tsx      — Sortable/filterable table with status badges
│   ├── store-promotion-settings.tsx — Read-only definitions with enable/disable toggle for the active store manager
│   ├── promotion-rules-editor.tsx — Dynamic rule rows (add products, categories, tiers, BXGY config)
│   ├── promotion-analytics-card.tsx — Redemption count, discounts granted, influenced order value, unique users
│   └── promotion-status-badge.tsx — Active/Scheduled/Expired/Exhausted badges
├── pages/
│   └── admin-promotions-page.tsx — List + create/edit modals
└── index.ts
```

#### [MODIFY] [admin-navigation](file:///F:/Shreyas/food/frontend/src/features/admin-navigation)

Add "Promotions" nav item with icon to the admin sidebar.

- Platform admins see full create/edit/schedule/media/budget/analytics controls.
- Store `manager` users see the effective promotion list for their selected store and may only opt out/re-enable. Other store roles do not receive the toggle permission.
- Protect the frontend routes for UX, while keeping backend capability/permission checks authoritative.

---

### Frontend — Customer Offers Experience

#### [NEW] [frontend/src/features/offers/](file:///F:/Shreyas/food/frontend/src/features/offers)

Customer-facing offers:

```
offers/
├── api/
│   └── offers.queries.ts       — useAvailableOffers(storeId)
├── model/
│   └── offers.types.ts
├── components/
│   ├── offer-card.tsx           — Visual card with image, description, badge, and link to eligible products (no Apply button)
│   ├── offers-banner.tsx        — Informational horizontal offer strip for cart/checkout (no Apply action)
│   ├── homepage-offers-slider.tsx — Responsive featured-offer slider with accessible controls
│   └── offers-grid.tsx          — Grid layout for the offers page
├── pages/
│   └── offers-page.tsx          — Browsable offers page
└── index.ts
```

#### [MODIFY] [checkout/components/coupon-field.tsx](file:///F:/Shreyas/food/frontend/src/features/checkout/components/coupon-field.tsx)

- Rename to `promotion-field.tsx`
- Show automatically applied offer names, or the manually applied coupon, never both
- Disable coupon entry when the quote reports an applied offer or pre-built deal combo; explain which cart line makes the cart ineligible
- Show "View Offers" link that opens offers modal/page

#### [MODIFY] [checkout/components/checkout-summary.tsx](file:///F:/Shreyas/food/frontend/src/features/checkout/components/checkout-summary.tsx)

- Update discount line to show promotion name and type
- Add visual indicator for offer vs coupon

#### [MODIFY] [checkout/model/checkout.types.ts](file:///F:/Shreyas/food/frontend/src/features/checkout/model/checkout.types.ts)

- Replace `Coupon` and `CouponPreview` types with promotion evaluation/application types
- Update `PricingQuote.coupon` → `PricingQuote.promotions[]` and add separate item/delivery/total savings fields

#### [MODIFY] [checkout/api/coupon.mutations.ts](file:///F:/Shreyas/food/frontend/src/features/checkout/api/coupon.mutations.ts)

Rename to `promotion.mutations.ts`. Update endpoint from `/coupon/validate` to `/promotions/validate`.

#### [MODIFY] [checkout-page.tsx](file:///F:/Shreyas/food/frontend/src/features/checkout/pages/checkout-page.tsx)

- Add offers banner component showing eligible offers
- Render automatic offer results from the server; offers have no manual Apply action
- Display `COUPON_NOT_COMBINABLE_WITH_OFFERS` clearly and link to the conflicting item(s); do not reproduce pricing rules in the UI

#### [MODIFY] Frontend router

Add `/offers` route for the customer-facing offers page.

#### [MODIFY] Home and catalogue experience

- Add the featured-offers slider to the home page using `/promotions/featured?storeId=...`.
- Use uploaded desktop/mobile images, meaningful alt text, explicit previous/next controls, keyboard support, and pause/reduced-motion behavior. Do not auto-advance for users requesting reduced motion.
- Show pre-built combo cards like other products with regular price struck through, deal price emphasized, savings shown, bundle contents listed, and one "Add combo" action.
- Cart/order lines show the combo as one purchased product while allowing its component summary to be expanded.

---

### Frontend — Orders Update

#### [MODIFY] [orders/components/order-coupon.tsx](file:///F:/Shreyas/food/frontend/src/features/orders/components/order-coupon.tsx)

Rename to `order-promotions.tsx`. Render the immutable promotion application list with name, kind badge, discount type, and exact savings.

#### [MODIFY] [orders/pages/](file:///F:/Shreyas/food/frontend/src/features/orders/pages)

Update admin and customer order detail pages to show promotion info instead of coupon info.

---

### Types & Utilities (Backend)

#### [MODIFY] [utils/types.ts](file:///F:/Shreyas/food/backend/src/utils/types.ts)

- Remove `CouponType`, `CouponRedemptionStatus`
- Add `PromotionKind`, `DiscountType`, `PromotionScope`, `PromotionRuleType`, `PromotionRedemptionStatus`, `DiscountMode`, and bundle product/component DTO types

#### [MODIFY] [utils/zodSchema.ts](file:///F:/Shreyas/food/backend/src/utils/zodSchema.ts)

- Remove `createCouponSchema`, `validateCouponSchema`
- Add promotion validation schemas (handled in the new promotions feature schemas file)

---

### Seeds

#### [MODIFY] Seed scripts

Update any seed scripts that create coupons to create promotions instead. Add seed data for:
- A percentage coupon (code: `WELCOME10`, 10% off)
- A fixed amount coupon (code: `FLAT100`, ₹100 off above ₹499)
- A free delivery offer (Free delivery above ₹599)
- A BXGY offer (Buy 2 pizzas, cheapest free)
- A first-order offer (20% off, first order only, max ₹150)
- A happy hour offer (30% off, 2pm-5pm weekdays)
- A pre-built pizza + drink bundle product with component rows, regular/compare-at price, deal price, and image
- At least two fixture-backed featured offer banners with desktop/mobile variants for the homepage slider

---

## Verification Plan

### Automated Tests

```bash
# Full preflight (lint + typecheck + test + build)
pnpm preflight
```

Specific test areas:
- `promotions/promotion.test.ts` — all eligibility and discount calculation logic
- `pricing/pricing.service.test.ts` — all discount types flowing through quote builder
- `checkout/checkout.service.test.ts` — reservation/consume/release lifecycle

### Manual Verification

1. **Admin flow**: Create each promotion type via admin UI, verify rules editor works
2. **Customer offers page**: Browse offers, apply one, verify cart updates
3. **Coupon flow**: Enter coupon code, verify validation and discount
4. **Exclusivity**: Add a product with an automatic ₹100 offer (or a deal combo), verify its advertised price remains unchanged and coupon entry/validation is blocked with a clear reason
5. **BXGY**: Add qualifying items, verify cheapest-item-free calculation
6. **Tiered**: Hit different spending thresholds, verify the correct tier applies automatically
7. **Free delivery**: Verify delivery fee removed when offer applied
8. **Targeting**: Test time-of-day, first-order, per-user-limit, product/category restrictions
9. **Analytics**: Check redemption counts, exact discounts granted, influenced order value, and unique users on the admin page
10. **Order history**: Verify promotion details shown on order detail pages
11. **Combo catalogue flow**: Compare regular versus deal price, add one pre-built combo line, show its contents, and validate component inventory behavior
12. **Promotion media**: Upload/replace desktop and mobile images, feature an offer, verify responsive homepage slider ordering/alt text/fallback, and confirm replaced/orphan file handling
13. **Store governance**: Verify a new promotion is enabled at every store by default; a manager can opt out/re-enable only their store; other store roles cannot toggle; only platform admin can alter definitions
14. **Financial impact**: Deliver discounted orders in two stores and verify store account `4100`, net recognized revenue, global promotion budget/analytics, and consolidated platform totals without double deduction; verify bundle compare-at savings do not post as discounts

---

## Cross-Verification Review & Recommended Amendments

**Reviewed against the repository on 2026-09-10.** The overall direction is sound and fits the existing centralized pricing design, but the original draft is not implementation-ready until the cardinality, accounting, concurrency, and eligibility policies below are made explicit. This section is authoritative where it conflicts with earlier sections.

### 1. Critical data-model correction: exclusive modes, potentially multiple offers

The confirmed rule is not offer/coupon stacking. An order is exclusively in `none`, `automatic_deals`, or `coupon` mode. Several automatic offers may still affect distinct lines, so the model remains one-to-many:

- Do **not** replace `orders.coupon_id` with a single `orders.promotion_id`.
- Do **not** make `promotion_redemptions.order_id` globally unique.
- Add immutable `orders.discount_mode` and reject mixed offer/coupon applications in the checkout transaction.
- Make `promotion_redemptions` the application/snapshot table with:
  - snapshot fields: `promotion_kind`, `promotion_name`, `promotion_code`, `discount_type`, and `definition_version`;
  - amount fields: `item_discount_paise`, `delivery_discount_paise`, and `total_savings_paise`;
  - `unique(order_id, promotion_id)` for idempotency;
  - a partial unique index allowing at most one active/reserved coupon per order.
- Add `promotion_discount_allocations` so the UI/analytics can explain which promotion discounted which order item or delivery component. Store `promotion_redemption_id`, nullable `order_item_id`, component (`item` or `delivery`), and allocated paise. Allocation/service invariants ensure a cart unit is discounted by at most one offer.
- Keep the order's existing aggregate money snapshot and expose `order.promotions[]`.

Historical order responses must read snapshot fields, not mutable promotion definitions. A promotion edit or deactivation must never rewrite a past order. Pre-built combo price savings are snapshotted separately on the bundle order line and are not promotion redemptions.

### 2. Separate item discount from delivery savings

The current order invariant is:

```text
grand_total = items_subtotal - discount + charged_delivery_fee + rounding
```

Consequently, a free-delivery promotion cannot simply be added to `orders.discount_paise` while also setting `delivery_fee_paise` to zero; that would double-count the benefit and break reconciliation.

Revise the quote contract to include:

```ts
discountMode: "none" | "automatic_deals" | "coupon";
itemDiscountPaise: number;       // feeds orders.discount_paise
deliveryDiscountPaise: number;   // standard fee minus charged fee
promotionSavingsPaise: number;   // item + delivery promotion savings
bundleMarkdownPaise: number;     // compare-at minus selling price; display only
totalDisplayedSavingsPaise: number;
couponEligibility: {
  eligible: boolean;
  reasonCode: "OFFER_APPLIED" | "DEAL_BUNDLE_PRESENT" | null;
  conflictingLineIds: number[];
};
promotions: Array<{
  id: number;
  kind: "offer" | "coupon";
  name: string;
  code: string | null;
  discountType: DiscountType;
  itemDiscountPaise: number;
  deliveryDiscountPaise: number;
  totalSavingsPaise: number;
  applied: true;
}>;
```

Preserve both the standard and charged delivery fee in the quote/application snapshot. The confirmed accounting policy treats waived delivery as zero delivery revenue plus marketing `deliveryDiscountPaise`; it does **not** post the waived amount to ledger account `4100`. Characterize this explicitly in commerce-posting and finance-report tests.

### 3. Define deterministic offer resolution and coupon exclusion

Coupons are manual only. Offers are resolved automatically from authoritative cart/store data and cannot be selected or removed independently from the eligible product. The server remains authoritative at final checkout.

Evaluation order:

1. Price authoritative store/cart items, including fixed selling prices for pre-built deal bundles.
2. Find all eligible automatic offers and select the highest-saving offer per line/unit. A unit can participate in only one offer, but different lines may receive different offers.
3. If any automatic offer applies, or any pre-built deal bundle is present, set discount mode to `automatic_deals` and reject a supplied coupon with `COUPON_NOT_COMBINABLE_WITH_OFFERS`. Do not remove/change the offer or bundle price to make the coupon fit.
4. Only when the cart is offer/deal-free, normalize and validate the manually supplied coupon and set discount mode to `coupon`.
5. Break equal-saving offer conflicts by `display_priority DESC`, then `promotion_id ASC` so preview and final checkout are stable.

Offer cards/banners are informational discovery surfaces and link to eligible products; they have no Apply button. Coupon eligibility can change only when cart contents or server-side promotion eligibility changes.

### 4. Reservation, concurrency, and idempotency are part of the feature

Coupon preview and offer browsing are advisory. COD creation and Razorpay initiation/finalization/retry/recovery must use the existing checkout transaction boundaries.

- Lock selected promotion rows in ascending ID order during final quote/reservation.
- Final resolution and manager toggles lock the same promotion/store rows in a documented order. This serializes checkout against an opt-out even when no setting row existed previously.
- Treat both `reserved` and `consumed` applications as using redemption capacity.
- Treat the sum of discounts on both `reserved` and `consumed` applications as using budget capacity; otherwise concurrent online checkouts can overspend the budget.
- Reserve the exact calculated amount when the order/payment hold is created. Release it on confirmed failure/expiry and consume it on COD creation or captured Razorpay payment, following the existing lifecycle.
- Make reserve/consume/release/restore operations collection-based and idempotent for every application row on the order.
- Protect `first_order_only` against two concurrent first checkouts. Lock the user (or an equivalent eligibility key). Existing orders in `awaiting_payment`, `pending`, `preparing`, `out_for_delivery`, or `delivered` disqualify; cancelled orders and failed payment attempts do not.
- Prefer `promotion_redemptions` as the source of truth for usage and spend. If `redemption_count` / `total_discount_spent_paise` remain as cached counters, update them in the same locked transaction and add reconciliation tests/tooling.
- Use explicit error codes such as `PROMOTION_NOT_FOUND`, `PROMOTION_INELIGIBLE`, `PROMOTION_CAPACITY_EXHAUSTED`, and `PROMOTION_BUDGET_EXHAUSTED`; the frontend should not parse message text.

The plan must update all current payment paths, not only `checkout.service.ts`: payment initiation, finalization, stale recovery, retry/restore, reconciliation DTOs/repository projections, and their tests currently carry singular coupon state.

### 5. Schema hardening

- Keep promotion definitions platform-wide. Use `store_promotion_settings` only for explicit store participation choices; absence means enabled. Do not copy or fork promotion definitions per store.
- Add a monotonic `definition_version` and increment it on material edits. This makes quote/order evidence explainable.
- Enforce normalized, case-insensitive codes with a unique index on `upper(btrim(code))` (partial where code is not null). Coupons require a code; public offers need not expose one.
- Use half-open validity windows (`starts_at <= now < ends_at`) and require `ends_at > starts_at`.
- Evaluate day/time windows in the selected store's IANA timezone. Permit overnight ranges such as 22:00-02:00; the proposed `start_time < end_time` check incorrectly rejects them. Define which local day owns an overnight window.
- Add checks for positive quantities, valid basis points, nonnegative paise, valid weekday values, tier uniqueness/order, and a per-`rule_type` nullability matrix. Cross-row rule completeness (for example, BXGY must have buy and get rules) belongs in service validation inside the write transaction.
- Add indexes for active discovery (`kind`, `is_active`, dates, priority), code lookup, target joins, and redemption eligibility queries (`promotion_id`, `user_id`, `status`).
- Define FK deletion behavior. Referenced promotions should be deactivated, not physically deleted. Child rule/target rows may cascade only when deleting an unreferenced draft.
- Consider type-specific tables (`promotion_product_targets`, `promotion_category_targets`, `promotion_tiers`) instead of one nullable-column-heavy rules table. Bundle components belong to the catalogue domain, not promotion rules. If the generic promotion rule table is kept, its discriminated checks are mandatory.
- Enforce bundle invariants: bundle and component IDs differ, no nested bundles, positive component quantity, compare-at price greater than selling price, and no duplicate component rows.
- Validate promotion media metadata: image and alt text appear together, homepage placement is offer-kind only, and featured offers have a usable desktop image. Keep storage paths relative rather than exposing server filesystem paths.
- Index store settings by unique `(promotion_id, store_id)` and by `(store_id, is_enabled)`. Platform promotion activation/deactivation overrides store settings; reactivation restores each store's last explicit choice.

### 6. Pricing semantics that must be written before coding

The promotion engine needs richer inputs than the proposed `PricingItemInput` currently supplies:

- `categoryId` for category targeting;
- authoritative store-specific price rather than trusting a client/global product price;
- base-product and customization amounts separately;
- unit-level identities or deterministic expansion for BXGY allocation.

Recommended policies:

- Minimum order is tested on the pre-promotion item subtotal, excluding delivery.
- Product/category percentage and fixed offers discount base-product value only unless the promotion explicitly opts into customization value.
- A pre-built combo enters pricing as one bundle product at its authoritative store selling price. Its compare-at price is display metadata and does not enter tax or grand-total arithmetic.
- Bundle component prices are not repriced or searched for in the cart. Component rows are used for contents and inventory allocation; customizations, if later supported, are charged separately.
- BXGY supports repeated groups (`floor(qualifying_buy_units / buy_quantity)`), consumes each unit once, and selects free units by lowest eligible authoritative unit price with a stable line/unit tie-breaker.
- Tier selection uses the pre-promotion eligible subtotal; exactly one highest qualifying tier applies to that offer or coupon.
- Fixed discounts are capped at the eligible basis, and aggregate item discounts can never exceed item subtotal.
- All arithmetic uses the existing integer-paise helpers and proportional allocation with deterministic remainder handling. Recompute inclusive tax from each post-discount line total.

Also harden public quote construction while touching it: validate store-product mapping/availability and use store prices. Promotion eligibility must never be calculated from client-supplied prices or category claims.

### 7. API, authorization, privacy, and audit

- Register the new router in `backend/src/routes.ts` and remove the legacy router only after all consumers move.
- Put static paths such as `/offers` and `/validate` before `/:id`, or use separate customer/admin routers.
- Protect definition/media/budget/analytics administration with `platform.promotions.manage`; only platform admins receive it.
- Add `store.promotions.toggle` only to the store `manager` role. Enforce the route's `storeId` through the existing store-permission middleware; a manager cannot change another store or any promotion definition.
- Audit platform create/update/activation/media operations and store enable/disable attempts with store ID, promotion ID/version, actor, before/after state, optional reason, and outcome. Promotion changes affect customer charges and budgets.
- Customer endpoints must never enumerate coupon-kind rows or leak hidden codes. Return public offer DTOs and stable eligibility reason codes, not database records.
- Add pagination bounds and filters to admin listing. Add abuse protection for coupon validation attempts.
- `GET /promotions/offers` should be cacheable discovery data if it does not depend on a cart. If it evaluates a submitted cart/user context, use an authenticated `POST /promotions/evaluate` or rely on `/checkout/quote` for authoritative evaluation.
- Checkout/quote requests accept only optional `couponCode`. They never accept `offerId`; offer applicability is server-derived. Coupon validation returns `COUPON_NOT_COMBINABLE_WITH_OFFERS` when any offer/deal bundle is present.
- An opted-out promotion behaves as unavailable only for new quotes/orders at that store and returns `PROMOTION_DISABLED_FOR_STORE` where relevant. Existing Razorpay reservations/order snapshots remain valid through completion/recovery so a manager toggle cannot invalidate an already-created provider amount.

### 8. Repository files omitted or understated in the original impact list

Cross-verification found these required update areas in addition to the listed files:

- `backend/src/routes.ts`
- `backend/src/utils/zodSchema.ts` for COD, Razorpay initiation, public quote, and validation payloads
- `backend/src/features/access/access.permissions.ts` and access tests
- `backend/src/features/payments/payment.service.ts`, `payment-finalization.service.ts`, `payment-stale-recovery.service.ts`, `payment.repository.ts`, `payment.types.ts`, and related tests
- `backend/src/features/system-maintenance/system-maintenance.service.ts` and tests (truncate/reset table list)
- `backend/src/features/order/order.mapper.ts`, not only routes/service
- catalogue, cart, inventory, and order-item snapshot paths for bundle product/component support
- promotion image storage/upload service plus static media serving and cleanup policy
- delivered-order finance event payload/builders, ledger commerce posting, finance reports, dashboards, and refund allocation characterization
- store permission definitions/tests plus manager-facing effective-promotion queries/toggle UI
- `backend/src/scripts/demo-financial-scenario.ts` and `backend/src/fixtures/financial-scenario.fixtures.ts`
- Checked-in Drizzle migration and migration metadata; fresh-database policy still requires a reproducible migration from an empty database
- `docs/api-reference.md`, `docs/database-schema.md`, `docs/architecture.md`, Razorpay/order lifecycle documentation, and the in-app docs under `frontend/src/features/docs`
- Frontend order types/queries/index exports, checkout query keys, payment mutation payloads, route guards, navigation, and system-reset copy

Run `rg -i "coupon" backend/src frontend/src docs readme.md` near completion. Remaining hits must be intentional domain wording, migration history, or documented compatibility—not stale identifiers.

### 9. Testing additions

Beyond unit tests for each formula, add:

- table-driven tests for best-offer-per-unit conflicts, offer/coupon exclusion, equal-saving tie-breaks, caps, and zero/one-paise remainder cases;
- property/invariant tests: discounts never negative, item allocations sum exactly, no line goes below zero, quote reconciliation holds, and tax components reconcile;
- timezone tests including DST-capable zones and overnight windows, even though seeded stores use `Asia/Kolkata`;
- concurrent capacity/budget/first-order integration tests against PostgreSQL (unit mocks cannot prove row-lock behavior);
- default-enabled and store opt-out tests, including cross-store authorization isolation, global deactivation precedence, reactivation behavior, and checkout-versus-toggle concurrency;
- COD and Razorpay lifecycle tests for multiple offer applications or one coupon application across reserve, consume, release, restore, duplicate webhook, and stale recovery paths;
- API authorization/privacy tests proving store staff/customer users cannot administer promotions or enumerate coupon codes;
- order snapshot tests proving later edits/deactivation do not change history;
- finance posting/report characterization tests proving free delivery creates zero delivery revenue and no account `4100` posting for the waived amount;
- finance integration tests proving product offers/coupons debit store-scoped account `4100`, reduce consolidated revenue once, and retain correct per-store/global attribution;
- bundle tests for component validation, compare-at display, store-specific selling price, component availability/inventory, snapshots, and coupon exclusion;
- upload tests for MIME/size/dimensions, authorization, filename/path safety, replacement ordering, fallback behavior, and orphan cleanup;
- empty-database migration + deterministic reset/seed smoke test;
- frontend component tests for automatic offer display, disabled/manual coupon behavior, stale quote/loading state, homepage slider accessibility, responsive images, bundle price display, and accessible form errors.

`pnpm preflight` remains the final static/unit gate, but database concurrency and the manual end-to-end matrix require an isolated migrated PostgreSQL database and should be recorded separately rather than implied by preflight.

### 10. Safer delivery sequence (one coordinated release is still possible)

1. **Contract and characterization:** record the confirmed policies as ADRs; capture current pricing, payment, finance, and coupon lifecycle tests.
2. **Schema and pure engine:** migration, types, DTOs, deterministic calculations, and rule validation.
3. **Transactional integration:** checkout plus every COD/Razorpay reservation, recovery, and idempotency path.
4. **Admin surface:** capability, audit, CRUD, rules editor, and analytics.
5. **Customer surface:** discovery/evaluation, quote integration, checkout UX, order history.
6. **Evidence:** seeds, reset, docs/in-app diagrams, empty-DB smoke test, concurrency tests, preflight, and manual matrix.

Deploy backend/frontend/schema together under the fresh-database policy, but keep these as independently reviewable commits. This will make the portfolio story much stronger than a single broad change set.

### 11. Portfolio-focused input for a 4+ year engineer

The differentiator should be depth of engineering judgment, not the number of discount types. The strongest case-study evidence will be:

- a short ADR for exclusive discount modes, free-delivery accounting, bundle modelling, timezones, and reservation capacity;
- deterministic money/tax invariants and concurrency proof;
- versioned immutable order/application snapshots;
- permission and audit boundaries for money-affecting admin actions;
- an architecture diagram from discovery -> quote -> reservation -> payment -> ledger;
- a concise trade-off note explaining why rules are normalized (or intentionally not), and measured query plans only if performance claims are made;
- screenshots/GIFs of the admin rule builder and customer quote breakdown, backed by links to tests and code.

If schedule is limited, ship percentage, fixed amount, free delivery, pre-built bundles, and one advanced promotion mechanic end-to-end before adding both BXGY and tiered rules. A smaller system with correct failure/recovery behavior presents as more senior than many partially specified calculators.

### 12. Resolved Owner Decisions

1. **Coupons:** Manual entry only; never auto-applied.
2. **Offers:** Admin-configured product/category offers apply automatically. The best offer wins for a given line/unit, and its advertised price is never changed to accommodate a coupon.
3. **Exclusivity:** Any applied offer or pre-built deal combo makes the entire cart coupon-ineligible. Orders never mix offer-kind and coupon-kind applications.
4. **Combos:** First-class pre-built catalogue bundles shown with regular/compare-at price versus deal selling price; added as one cart line with visible components.
5. **Images:** Full admin uploads for offer/promotion desktop and mobile images, with selected offers displayed in a responsive homepage slider.
6. **First order:** Cancelled orders and failed payment attempts do not consume eligibility; active/in-progress/delivered orders do.
7. **Free delivery:** Record zero charged delivery revenue and marketing delivery savings; do not post waived delivery to ledger account `4100`.
8. **Ownership:** Promotion definitions are global and platform-admin-only. Stores participate by default; only the store `manager` may opt their own store out or back in.
9. **Financial attribution:** Item offers/coupons reduce the fulfilling store's revenue through account `4100`; platform reporting consolidates those net store results without a second deduction. Combo compare-at markdown is display-only.

No additional owner decision is required before implementation. The only implementation assumption is that multiple offers may coexist when they affect distinct cart lines/units; the best single offer wins wherever offers overlap.
