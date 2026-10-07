import type { DiagramDefinition } from "../../components/diagram-card";
import { codRequest } from "./architecture";

export const codLifecycle: DiagramDefinition = {
  ...codRequest,
  title: "COD / Commit locally, notify afterward",
};

export const onlineInitiation: DiagramDefinition = {
  title: "Online / Local intent before provider creation",
  caption: "The successful creation path crosses three separate local transactions. The provider call is outside all three.",
  wide: true,
  explanation: [
    "Initiation checks the client request ID. An existing same-user attempt is reused; the diagram follows a new attempt.",
    "Transaction A validates the final quote, snapshots prices and promotion allocations, creates payment/order intent, reserves inventory and exact promotion capacity/budget, clears the cart, and commits.",
    "Transaction B locks the payment and claims provider creation by changing it to processing, then commits. Concurrent callers can return the existing processing attempt.",
    "Razorpay order creation happens after that commit. The result must match the local amount, currency, and expected created status.",
    "Transaction C locks the payment and attaches the provider order. The browser can then open provider Checkout. Capture is a later flow, not part of these transactions.",
  ],
  source: `sequenceDiagram
    accTitle: Online payment initiation transaction boundaries
    accDescr: Local checkout commits first, provider creation is claimed separately, Razorpay is called outside SQL transactions, then its order is attached.
    participant B as Browser
    participant A as Payment service
    participant D as PostgreSQL
    participant P as Razorpay
    B->>A: Initiate with client request ID
    A->>D: Look up existing attempt
    D-->>A: No existing attempt
    rect rgb(228, 240, 231)
      Note over A,D: Transaction A - local checkout
      A->>D: Begin; validate quote and lock stock
      A->>D: Pending payment and awaiting-payment order
      A->>D: Immutable snapshots; stock and promotion reservations
      A->>D: Clear cart; commit
    end
    rect rgb(241, 234, 223)
      Note over A,D: Transaction B - claim provider creation
      A->>D: Lock payment; set processing; commit
    end
    A->>P: Create provider order
    P-->>A: Provider order identity, amount and currency
    Note over A: Validate provider response
    rect rgb(228, 240, 231)
      Note over A,D: Transaction C - attach provider order
      A->>D: Lock payment; save provider identity; commit
    end
    A-->>B: Checkout data
    B->>P: Open provider Checkout`,
};

export const captureLifecycle: DiagramDefinition = {
  title: "Capture / Verify externally, finalize locally",
  caption: "The callback and webhook converge on reconciliation, but signature checks, webhook claims, finalization, and event delivery are distinct steps.",
  wide: true,
  explanation: [
    "A customer callback verifies order ownership and checkout signature; a webhook verifies its raw-body signature and claims an event ID. These entry points have different authentication mechanisms.",
    "Reconciliation fetches current provider order/payment state outside the finalization transaction. Capture requires matching identities, currency and amounts, captured payment, paid order, exact amount paid and zero due.",
    "The local transaction locks order/payment and rechecks payable or already-completed state. Completion consumes saved inventory and promotion applications, records sales, completes payment and sets the order pending.",
    "A repeated completion with the same provider payment ID returns without consuming stock again. Verified late capture may restore released holds under the saved contract; a cancelled order requires operational resolution.",
    "After commit, the caller may emit notifications. Webhook processing status is recorded separately. Neither proves durable event delivery.",
  ],
  source: `sequenceDiagram
    accTitle: Payment capture reconciliation
    accDescr: Verified callback or webhook fetches provider state, then finalizes order and inventory in a local transaction.
    participant E as Verified callback or claimed webhook
    participant R as Reconciliation service
    participant P as Razorpay
    participant D as PostgreSQL
    E->>R: Reconcile provider payment
    R->>P: Fetch order and payment
    P-->>R: Current provider state
    Note over R: Validate identities, captured and paid state, currency and amounts
    rect rgb(228, 240, 231)
      Note over R,D: Finalization transaction
      R->>D: Lock joined order and payment rows
      alt Same payment already completed
        D-->>R: Existing result; finalizedNow false
      else Awaiting payment with usable reservations
        R->>D: Lock stock and active reservations in sorted order
        R->>D: Consume reservations; deduct stock; append sales
        R->>D: Complete payment; order pending; consume promotion applications
      end
      R->>D: Commit
    end
    R-->>E: Result and finalizedNow
    Note over E: Caller handles post-commit notifications separately`,
};

export const orderTransitions: DiagramDefinition = {
  title: "Order state / The current transition map",
  caption: "This is the implemented order transition map, not a payment state machine. Same-state requests are no-ops.",
  explanation: [
    "Online orders start awaiting_payment; COD orders start pending. The shared map permits awaiting_payment to pending or cancelled.",
    "Pending can move to preparing or cancelled. Preparing advances to out_for_delivery, then delivered; cancellation is allowed before delivery.",
    "Delivered and cancelled are terminal; delivered is the canonical stored identifier.",
    "Staff updates also require permission, and payment finalization independently validates provider/payable state. The map by itself is not proof of payment completion.",
  ],
  source: `stateDiagram-v2
    accTitle: Current order transitions
    accDescr: Online starts awaiting payment, COD starts pending, pending advances to preparing and delivered, with cancellation before terminal states.
    state "Awaiting payment" as awaiting_payment
    state "Pending" as pending
    state "Preparing" as preparing
    state "Out for delivery" as out_for_delivery
    state "Delivered" as delivered
    state "Cancelled" as cancelled
    [*] --> awaiting_payment: Online creation
    [*] --> pending: COD creation
    awaiting_payment --> pending
    awaiting_payment --> cancelled
    pending --> preparing
    pending --> cancelled
    preparing --> out_for_delivery
    preparing --> cancelled
    out_for_delivery --> delivered
    out_for_delivery --> cancelled
    delivered --> [*]
    cancelled --> [*]`,
};
