export const inventoryLedgerExample = [
  {
    change: "Adjustment",
    reason: "Opening count",
    quantityChange: "+6",
    previousQuantity: 0,
    newQuantity: 6,
  },
  {
    change: "Sale",
    reason: "Captured order #410",
    quantityChange: "-2",
    previousQuantity: 6,
    newQuantity: 4,
  },
  {
    change: "Restock",
    reason: "Kitchen delivery",
    quantityChange: "+3",
    previousQuantity: 4,
    newQuantity: 7,
  },
  {
    change: "Adjustment",
    reason: "One damaged item",
    quantityChange: "-1",
    previousQuantity: 7,
    newQuantity: 6,
  },
  {
    change: "Cancellation",
    reason: "Restore order #410",
    quantityChange: "+2",
    previousQuantity: 6,
    newQuantity: 8,
  },
] as const;

export const lockPaths = [
  {
    operation: "COD or online checkout",
    sequence: "Cart -> user eligibility -> store -> catalogue and stock in ascending IDs -> promotions in ascending IDs -> existing store settings",
    result: "Demand is validated while stock locks are held. COD deducts tracked stock; online checkout inserts reservations before commit.",
  },
  {
    operation: "Payment capture",
    sequence: "Order -> user eligibility -> store -> payment -> store-product/reservation rows by ascending ID -> promotion collections",
    result: "The transaction consumes reservations, deducts on-hand stock, appends sale movements, and completes local payment/order state.",
  },
  {
    operation: "Order cancellation",
    sequence: "Order row -> release active reservations -> sale/cancellation movement reads -> store-product rows by ascending ID",
    result: "Unsold holds are released. Previously sold tracked stock is restored once through cancellation movements.",
  },
  {
    operation: "Safe expiry",
    sequence: "Provider reads outside SQL -> order row -> payment row -> release inventory and promotion applications",
    result: "Uncertain or unsafe provider state preserves the reservation instead of entering the release transaction.",
  },
  {
    operation: "Staff restock or adjustment",
    sequence: "Membership row for non-admin staff -> store-product row(s); adjustment then reads active reservation totals",
    result: "Restock, adjustment, and audit share the transaction. An adjustment target below reserved quantity is rejected.",
  },
  {
    operation: "Manual store availability",
    sequence: "Permission check -> store-product row",
    result: "The store-level availability flag changes independently of on-hand stock and movement records.",
  },
] as const;

export const operationalInteractions = [
  {
    title: "Payment failure",
    behavior: "A confirmed provider failure releases active stock and promotion reservations. On-hand quantity was never deducted for the online hold, so release changes displayed availability without adding stock.",
    limit: "The order remains awaiting_payment. Retry restores saved inventory demand and promotion capacity atomically when current availability permits.",
  },
  {
    title: "Reservation deadline",
    behavior: "Online reservations default to a deadline 30 minutes after creation. A row remains active while its status is reserved; the timestamp alone does not release it.",
    limit: "The reconciliation command is one-shot and no deployed schedule was found. Provider errors, ambiguous payment state, and unsafe capture state preserve the hold.",
  },
  {
    title: "Late capture",
    behavior: "Verified capture can restore released holds on a still-payable order. Inventory availability remains enforced; expiry-cancelled orders are rejected by the payable-state check.",
    limit: "Stock shortages or an already cancelled order require operational resolution; a capture mismatch does not automatically issue a refund.",
  },
  {
    title: "Restock and adjustment",
    behavior: "Staff writes serialize on the store-product row used by checkout. Restock adds to tracked stock; untracked stock needs an opening adjustment. Adjustment cannot set on-hand below active reservations.",
    limit: "These policies are covered by pure logic and mocked service tests. No live admin-versus-checkout database race was executed.",
  },
] as const;
