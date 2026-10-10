export const cancellationRows = [
  {
    trigger: "Authorized cancellation: awaiting-payment online order",
    reservations: "Active stock reservations released.",
    stock: "Normally no recorded sale to restore.",
    promotions: "Reserved applications released; consumed applications are not reversed.",
    payment: "Order cancelled; payment status unchanged.",
    recovery: "Compare any later provider capture with the cancelled local order; resolve outside automatic finalization.",
  },
  {
    trigger: "Authorized cancellation: pending, preparing or out-for-delivery COD",
    reservations: "No online reservation in normal COD flow.",
    stock: "Recorded sales restored once while stock remains tracked; cancellation movement appended.",
    promotions: "Consumed applications remain consumed; counts derive from application states.",
    payment: "Order cancelled; COD payment remains pending.",
    recovery: "No online refund operation applies; review retained payment and promotion applications as needed.",
  },
  {
    trigger: "Authorized cancellation: pending, preparing or out-for-delivery paid online order",
    reservations: "Consumed reservations remain consumed.",
    stock: "Recorded sales restored once while stock remains tracked.",
    promotions: "Consumed applications remain consumed; counts derive from application states.",
    payment: "Order cancelled; completed payment remains completed.",
    recovery: "A refund requires separate operational handling; this code path makes no provider refund call.",
  },
  {
    trigger: "Safe expiry: local order still awaiting payment",
    reservations: "Active reservations released after provider-state checks.",
    stock: "Reservation release increases availability without increasing on-hand stock.",
    promotions: "Reserved applications released.",
    payment: "Order cancelled; pending/processing payment becomes failed. Already-failed status remains failed.",
    recovery: "Inspect reconciliation conflicts/errors. Late capture cannot automatically revive the cancelled order.",
  },
] as const;

export const recoveryScenarios = [
  {
    title: "The provider call times out",
    behavior: "The creation error path marks the local payment failed and releases stock/promotion reservations. The cart was already cleared. A timeout alone cannot establish whether the provider created an order.",
    limit: "Stale-payment reconciliation can recover provider identity by receipt. Customer retry and verified capture restore saved holds when policy permits; SQL cannot undo an external success.",
  },
  {
    title: "Provider creation succeeds; attachment fails",
    behavior: "The service logs the local and provider identifiers. A later stale-payment scan can recover the provider order by its deterministic receipt, validate it, and attach it.",
    limit: "This is a recovery mechanism, not proof of provider-side exactly-once creation. Multiple matching receipt results are rejected by the gateway.",
  },
  {
    title: "A failed payment is observed",
    behavior: "Reconciliation checks for a captured or authorized payment on the provider order before accepting a failed observation. A confirmed failed payment releases active holds and leaves the local order awaiting_payment.",
    limit: "Retry restores saved stock demand and all promotion applications in one transaction. Current capacity or stock shortages reject the whole retry; saved prices are retained.",
  },
  {
    title: "The browser window is dismissed",
    behavior: "Closing provider Checkout does not invoke the order cancellation service. The local attempt and any active reservation remain for subsequent handling.",
    limit: "Do not interpret a client dismissal as proof of payment failure, stock release, or a refund.",
  },
  {
    title: "The callback and webhook arrive together",
    behavior: "Both paths use the same locked finalizer. After one completes, the same provider payment ID returns finalizedNow: false. A different completed payment ID conflicts.",
    limit: "Mocked service tests inspect repeat behavior; they do not establish live race correctness. A crash between commit and notification can still lose delivery.",
  },
  {
    title: "The reservation deadline passes",
    behavior: "Rows remain active until their status changes. Expiry reconciliation preserves reservations when provider state is unavailable, ambiguous, or unsafe to expire; still-reserved rows can be consumed after their deadline.",
    limit: "A default 30-minute deadline is not a punctual release guarantee. No deployed scheduler was established in the audit.",
  },
  {
    title: "Capture arrives after release or cancellation",
    behavior: "Verified late capture can restore released stock and promotion applications under the saved contract before consuming them. Only captured provider money may bypass current promotion capacity; inventory must still be physically available.",
    limit: "Cancelled orders and insufficient inventory require operational resolution. Customer retry cannot bypass capacity, and capture never reprices the saved order.",
  },
] as const;
