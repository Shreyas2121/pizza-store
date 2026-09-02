---
name: financial-overhaul
description: |
  Agent-optimized extract of the financial overhaul execution guide.
  Load this skill when working on finance-related commits on the
  feature/financial-overhaul branch.
---

# Financial Overhaul Skill

This skill provides the key execution context for the PizzaStore financial overhaul. The full canonical document is `guide.md` at the repo root.

## Architecture

- **Pricing service** (`backend/src/features/pricing/pricing.service.ts`) is the single source of truth for all financial calculations.
- `buildQuote()` produces a complete, immutable pricing snapshot with item subtotals, coupon discounts, delivery fees, and inclusive tax.
- All values are **integer paise**. No floats anywhere in domain or persistence.

## Key Services

| Service | Location | Responsibility |
|---|---|---|
| Pricing | `pricing/pricing.service.ts` | Quote building, tax, delivery fee |
| Checkout | `checkout/checkout.service.ts` | Public quote endpoint, cart resolution |
| Order | `order/order.service.ts` | Order creation, status lifecycle |
| Payment | `payments/payment.service.ts` | Razorpay integration, reconciliation |
| Inventory | `inventory/inventory.service.ts` | Stock tracking, reservations |

## Commit Sequence

Refer to `guide.md` §5–16 for the full phase-by-phase execution plan. Each phase produces one or more coherent commits following the convention:

```
feat(scope): description
fix(scope): description
```

## Financial Rules

1. Never trust browser-calculated prices — always use server `buildQuote()`.
2. Tax is inclusive (demo: 5% food, 18% delivery) computed via `calculateInclusiveTax`.
3. Coupon discounts are proportionally allocated across item lines.
4. Delivery fee uses store-scoped rules with timezone-aware business date lookup.
5. Grand total = items subtotal − discount + delivery fee (tax is inclusive, not additive).

## Testing

- All pricing logic has deterministic Vitest tests with fixture-driven scenarios.
- Financial scenario fixtures live in `backend/src/fixtures/`.
- Tests must pass with exact paise assertions — no floating-point tolerance.

## References

- Full guide: `guide.md` (root)
- Product decisions: `plan.md` (root)
- Finance API rollout: `docs/finance-api-compatibility-rollout.md`
