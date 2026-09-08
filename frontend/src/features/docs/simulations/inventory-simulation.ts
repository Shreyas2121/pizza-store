export const inventoryCustomerIds = ["customer-a", "customer-b"] as const;

export type InventoryCustomerId = (typeof inventoryCustomerIds)[number];
export type InventoryScenarioId = "successful_capture" | "payment_failure" | "reservation_expiry";
export type CheckoutStatus =
  | "idle"
  | "in_transaction"
  | "waiting_for_lock"
  | "reservation_committed"
  | "rejected"
  | "finalizing"
  | "payment_failed"
  | "cancelled_after_expiry"
  | "completed";
export type ReservationStatus = "none" | "reserved" | "consumed" | "released";
export type PaymentOutcome = "not_started" | "pending" | "captured" | "failed";

export type InventorySimulationEvent =
  | { type: "checkout_started"; customer: InventoryCustomerId }
  | { type: "retry_started"; customer: InventoryCustomerId }
  | { type: "lock_requested"; customer: InventoryCustomerId }
  | { type: "lock_acquired"; customer: InventoryCustomerId }
  | { type: "stock_validated"; customer: InventoryCustomerId }
  | { type: "reservation_created"; customer: InventoryCustomerId }
  | { type: "transaction_committed"; customer: InventoryCustomerId }
  | { type: "capture_started"; customer: InventoryCustomerId }
  | { type: "payment_captured"; customer: InventoryCustomerId }
  | { type: "payment_failed"; customer: InventoryCustomerId }
  | { type: "reservation_deadline_passed"; customer: InventoryCustomerId }
  | {
      type: "expiry_processed";
      customer: InventoryCustomerId;
      providerState: "safe_to_release";
    };

export interface InventoryItemState {
  productName: string;
  isTracked: true;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface InventoryLockState {
  owner: InventoryCustomerId | null;
  waiting: readonly InventoryCustomerId[];
}

export interface CustomerSimulationState {
  id: InventoryCustomerId;
  label: string;
  attempts: number;
  checkoutStatus: CheckoutStatus;
  stockValidated: boolean;
}

export interface ReservationSimulationState {
  customer: InventoryCustomerId;
  status: ReservationStatus;
  quantity: number;
  deadlinePassed: boolean;
}

export interface InventoryHistoryEntry {
  step: number;
  event: InventorySimulationEvent;
  description: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lockOwner: InventoryCustomerId | null;
  waiting: readonly InventoryCustomerId[];
}

export interface InventorySimulationState {
  inventory: InventoryItemState;
  lock: InventoryLockState;
  customers: Record<InventoryCustomerId, CustomerSimulationState>;
  reservations: Record<InventoryCustomerId, ReservationSimulationState>;
  payments: Record<InventoryCustomerId, PaymentOutcome>;
  history: readonly InventoryHistoryEntry[];
}

export interface InventorySimulationInvariants {
  quantitiesAreNonNegativeIntegers: boolean;
  availabilityMatchesReservations: boolean;
  atMostOneCustomerIsAllocated: boolean;
  lockOwnerIsNotWaiting: boolean;
}

export interface InventoryScenario {
  id: InventoryScenarioId;
  title: string;
  summary: string;
  outcome: string;
  events: readonly InventorySimulationEvent[];
}

export class InventorySimulationTransitionError extends Error {
  constructor(
    message: string,
    readonly event: InventorySimulationEvent,
    readonly completedSteps: number
  ) {
    super(message);
    this.name = "InventorySimulationTransitionError";
  }
}

const customerLabel = (customer: InventoryCustomerId) =>
  customer === "customer-a" ? "Customer A" : "Customer B";

const emptyReservation = (
  customer: InventoryCustomerId
): ReservationSimulationState => ({
  customer,
  status: "none",
  quantity: 0,
  deadlinePassed: false,
});

export const createInitialInventorySimulationState = (): InventorySimulationState => ({
  inventory: {
    productName: "Final tracked pizza",
    isTracked: true,
    onHandQuantity: 1,
    reservedQuantity: 0,
    availableQuantity: 1,
  },
  lock: { owner: null, waiting: [] },
  customers: {
    "customer-a": {
      id: "customer-a",
      label: "Customer A",
      attempts: 0,
      checkoutStatus: "idle",
      stockValidated: false,
    },
    "customer-b": {
      id: "customer-b",
      label: "Customer B",
      attempts: 0,
      checkoutStatus: "idle",
      stockValidated: false,
    },
  },
  reservations: {
    "customer-a": emptyReservation("customer-a"),
    "customer-b": emptyReservation("customer-b"),
  },
  payments: {
    "customer-a": "not_started",
    "customer-b": "not_started",
  },
  history: [],
});

const reservedQuantity = (state: InventorySimulationState) =>
  inventoryCustomerIds.reduce(
    (total, customer) =>
      total +
      (state.reservations[customer].status === "reserved"
        ? state.reservations[customer].quantity
        : 0),
    0
  );

export const inspectInventorySimulationInvariants = (
  state: InventorySimulationState
): InventorySimulationInvariants => {
  const reserved = reservedQuantity(state);
  const allocatedCustomers = inventoryCustomerIds.filter((customer) =>
    ["reserved", "consumed"].includes(state.reservations[customer].status)
  );
  const quantities = [
    state.inventory.onHandQuantity,
    state.inventory.reservedQuantity,
    state.inventory.availableQuantity,
    ...inventoryCustomerIds.map((customer) => state.reservations[customer].quantity),
  ];

  return {
    quantitiesAreNonNegativeIntegers: quantities.every(
      (quantity) => Number.isSafeInteger(quantity) && quantity >= 0
    ),
    availabilityMatchesReservations:
      state.inventory.reservedQuantity === reserved &&
      state.inventory.availableQuantity ===
        Math.max(0, state.inventory.onHandQuantity - reserved),
    atMostOneCustomerIsAllocated: allocatedCustomers.length <= 1,
    lockOwnerIsNotWaiting:
      state.lock.owner === null || !state.lock.waiting.includes(state.lock.owner),
  };
};

const assertInvariants = (state: InventorySimulationState) => {
  const checks = inspectInventorySimulationInvariants(state);
  const failed = Object.entries(checks)
    .filter(([, passes]) => !passes)
    .map(([name]) => name);
  if (failed.length > 0) {
    throw new Error(`Inventory simulation invariant failed: ${failed.join(", ")}`);
  }
};

const recordTransition = (
  state: InventorySimulationState,
  event: InventorySimulationEvent,
  description: string
): InventorySimulationState => {
  const reserved = reservedQuantity(state);
  const normalized: InventorySimulationState = {
    ...state,
    inventory: {
      ...state.inventory,
      reservedQuantity: reserved,
      availableQuantity: Math.max(0, state.inventory.onHandQuantity - reserved),
    },
  };
  assertInvariants(normalized);
  const historyEntry: InventoryHistoryEntry = {
    step: normalized.history.length + 1,
    event,
    description,
    onHandQuantity: normalized.inventory.onHandQuantity,
    reservedQuantity: normalized.inventory.reservedQuantity,
    availableQuantity: normalized.inventory.availableQuantity,
    lockOwner: normalized.lock.owner,
    waiting: [...normalized.lock.waiting],
  };
  return { ...normalized, history: [...normalized.history, historyEntry] };
};

const invalidTransition = (
  state: InventorySimulationState,
  event: InventorySimulationEvent,
  message: string
): never => {
  throw new InventorySimulationTransitionError(
    message,
    event,
    state.history.length
  );
};

const assertNever = (event: never): never => {
  throw new Error(`Unhandled inventory simulation event: ${JSON.stringify(event)}`);
};

export const transitionInventorySimulation = (
  state: InventorySimulationState,
  event: InventorySimulationEvent
): InventorySimulationState => {
  const customer = state.customers[event.customer];
  const reservation = state.reservations[event.customer];
  const payment = state.payments[event.customer];
  const label = customerLabel(event.customer);

  switch (event.type) {
    case "checkout_started": {
      if (customer.checkoutStatus !== "idle") {
        return invalidTransition(state, event, `${label} already started a checkout attempt.`);
      }
      return recordTransition(
        {
          ...state,
          customers: {
            ...state.customers,
            [event.customer]: {
              ...customer,
              attempts: 1,
              checkoutStatus: "in_transaction",
              stockValidated: false,
            },
          },
        },
        event,
        `${label} starts checkout attempt 1 for the final tracked item.`
      );
    }

    case "retry_started": {
      if (customer.checkoutStatus !== "rejected") {
        return invalidTransition(state, event, `${label} can retry only after a rejected checkout.`);
      }
      if (state.inventory.availableQuantity < 1) {
        return invalidTransition(state, event, `${label} cannot start a new attempt before stock is released.`);
      }
      return recordTransition(
        {
          ...state,
          customers: {
            ...state.customers,
            [event.customer]: {
              ...customer,
              attempts: customer.attempts + 1,
              checkoutStatus: "in_transaction",
              stockValidated: false,
            },
          },
        },
        event,
        `${label} explicitly starts checkout attempt ${customer.attempts + 1}; the rejected request was not resumed.`
      );
    }

    case "lock_requested": {
      if (customer.checkoutStatus !== "in_transaction") {
        return invalidTransition(state, event, `${label} has no active checkout transaction that can request the stock lock.`);
      }
      if (state.lock.owner === event.customer) {
        return invalidTransition(state, event, `${label} already owns the stock lock.`);
      }
      if (state.lock.owner === null) {
        return recordTransition(
          { ...state, lock: { ...state.lock, owner: event.customer } },
          event,
          `${label} acquires the store-product row lock.`
        );
      }
      if (state.lock.waiting.includes(event.customer)) {
        return invalidTransition(state, event, `${label} is already waiting for the stock lock.`);
      }
      return recordTransition(
        {
          ...state,
          lock: { ...state.lock, waiting: [...state.lock.waiting, event.customer] },
          customers: {
            ...state.customers,
            [event.customer]: {
              ...customer,
              checkoutStatus: "waiting_for_lock",
            },
          },
        },
        event,
        `${label} waits because ${customerLabel(state.lock.owner)} owns the store-product row lock.`
      );
    }

    case "lock_acquired": {
      if (
        state.lock.owner !== null ||
        customer.checkoutStatus !== "waiting_for_lock" ||
        !state.lock.waiting.includes(event.customer)
      ) {
        return invalidTransition(state, event, `${label} is not eligible to acquire the released stock lock.`);
      }
      return recordTransition(
        {
          ...state,
          lock: {
            owner: event.customer,
            waiting: state.lock.waiting.filter((waiting) => waiting !== event.customer),
          },
          customers: {
            ...state.customers,
            [event.customer]: {
              ...customer,
              checkoutStatus: "in_transaction",
            },
          },
        },
        event,
        `${label} acquires the row lock after the previous transaction commits.`
      );
    }

    case "stock_validated": {
      if (state.lock.owner !== event.customer) {
        return invalidTransition(state, event, `${label} must own the stock lock before validating availability.`);
      }
      if (state.inventory.availableQuantity < 1) {
        return recordTransition(
          {
            ...state,
            lock: { ...state.lock, owner: null },
            customers: {
              ...state.customers,
              [event.customer]: {
                ...customer,
                checkoutStatus: "rejected",
                stockValidated: false,
              },
            },
          },
          event,
          `${label} sees displayed availability 0. This checkout is rejected and its transaction lock is released.`
        );
      }
      return recordTransition(
        {
          ...state,
          customers: {
            ...state.customers,
            [event.customer]: { ...customer, stockValidated: true },
          },
        },
        event,
        `${label} validates aggregate demand 1 against displayed availability ${state.inventory.availableQuantity}.`
      );
    }

    case "reservation_created": {
      if (state.lock.owner !== event.customer || !customer.stockValidated) {
        return invalidTransition(state, event, `${label} must validate stock while holding the lock before reserving it.`);
      }
      if (reservation.status !== "none" || state.inventory.availableQuantity < 1) {
        return invalidTransition(state, event, `${label} cannot create another reservation for this item.`);
      }
      return recordTransition(
        {
          ...state,
          reservations: {
            ...state.reservations,
            [event.customer]: {
              ...reservation,
              status: "reserved",
              quantity: 1,
              deadlinePassed: false,
            },
          },
        },
        event,
        `${label} inserts a reservation for 1. On-hand stays at ${state.inventory.onHandQuantity}.`
      );
    }

    case "transaction_committed": {
      if (state.lock.owner !== event.customer || reservation.status !== "reserved") {
        return invalidTransition(state, event, `${label} has no reserved checkout transaction to commit.`);
      }
      if (payment !== "not_started") {
        return invalidTransition(state, event, `${label} already has a payment outcome for this attempt.`);
      }
      return recordTransition(
        {
          ...state,
          lock: { ...state.lock, owner: null },
          customers: {
            ...state.customers,
            [event.customer]: {
              ...customer,
              checkoutStatus: "reservation_committed",
              stockValidated: false,
            },
          },
          payments: { ...state.payments, [event.customer]: "pending" },
        },
        event,
        `${label} commits. The row lock ends, while the reservation and pending payment persist.`
      );
    }

    case "capture_started": {
      if (state.lock.owner !== null) {
        return invalidTransition(state, event, `${label} cannot start capture while another transaction owns the stock lock.`);
      }
      if (payment !== "pending" || reservation.status !== "reserved") {
        return invalidTransition(state, event, `${label} has no active reservation that can be captured.`);
      }
      return recordTransition(
        {
          ...state,
          lock: { ...state.lock, owner: event.customer },
          customers: {
            ...state.customers,
            [event.customer]: { ...customer, checkoutStatus: "finalizing" },
          },
        },
        event,
        `${label}'s verified capture transaction acquires the stock lock.`
      );
    }

    case "payment_captured": {
      if (payment === "captured") {
        return recordTransition(
          state,
          event,
          `${label}'s repeated capture is already complete; stock is not deducted again.`
        );
      }
      if (
        state.lock.owner !== event.customer ||
        payment !== "pending" ||
        reservation.status !== "reserved"
      ) {
        return invalidTransition(state, event, `${label} cannot finalize without a locked active reservation and pending payment.`);
      }
      if (state.inventory.onHandQuantity < reservation.quantity) {
        return invalidTransition(state, event, `${label}'s reservation exceeds on-hand stock.`);
      }
      return recordTransition(
        {
          ...state,
          inventory: {
            ...state.inventory,
            onHandQuantity:
              state.inventory.onHandQuantity - reservation.quantity,
          },
          lock: { ...state.lock, owner: null },
          reservations: {
            ...state.reservations,
            [event.customer]: { ...reservation, status: "consumed" },
          },
          payments: { ...state.payments, [event.customer]: "captured" },
          customers: {
            ...state.customers,
            [event.customer]: { ...customer, checkoutStatus: "completed" },
          },
        },
        event,
        `${label}'s reservation is consumed and on-hand stock is deducted once.`
      );
    }

    case "payment_failed": {
      if (state.lock.owner !== null || payment !== "pending" || reservation.status !== "reserved") {
        return invalidTransition(state, event, `${label} has no releasable pending reservation.`);
      }
      return recordTransition(
        {
          ...state,
          reservations: {
            ...state.reservations,
            [event.customer]: { ...reservation, status: "released" },
          },
          payments: { ...state.payments, [event.customer]: "failed" },
          customers: {
            ...state.customers,
            [event.customer]: { ...customer, checkoutStatus: "payment_failed" },
          },
        },
        event,
        `${label}'s confirmed payment failure releases the reservation. On-hand remains unchanged.`
      );
    }

    case "reservation_deadline_passed": {
      if (payment !== "pending" || reservation.status !== "reserved" || reservation.deadlinePassed) {
        return invalidTransition(state, event, `${label} has no active reservation whose deadline can pass.`);
      }
      return recordTransition(
        {
          ...state,
          reservations: {
            ...state.reservations,
            [event.customer]: { ...reservation, deadlinePassed: true },
          },
        },
        event,
        `${label}'s deadline passes. The still-reserved row continues to count against availability.`
      );
    }

    case "expiry_processed": {
      if (
        event.providerState !== "safe_to_release" ||
        state.lock.owner !== null ||
        payment !== "pending" ||
        reservation.status !== "reserved" ||
        !reservation.deadlinePassed
      ) {
        return invalidTransition(state, event, `${label}'s reservation is not safe and eligible for expiry release.`);
      }
      return recordTransition(
        {
          ...state,
          reservations: {
            ...state.reservations,
            [event.customer]: { ...reservation, status: "released" },
          },
          payments: { ...state.payments, [event.customer]: "failed" },
          customers: {
            ...state.customers,
            [event.customer]: {
              ...customer,
              checkoutStatus: "cancelled_after_expiry",
            },
          },
        },
        event,
        `Provider state is safe to expire. ${label}'s order is cancelled and its reservation is released.`
      );
    }

    default:
      return assertNever(event);
  }
};

const contestedReservationEvents = [
  { type: "checkout_started", customer: "customer-a" },
  { type: "lock_requested", customer: "customer-a" },
  { type: "checkout_started", customer: "customer-b" },
  { type: "lock_requested", customer: "customer-b" },
  { type: "stock_validated", customer: "customer-a" },
  { type: "reservation_created", customer: "customer-a" },
  { type: "transaction_committed", customer: "customer-a" },
  { type: "lock_acquired", customer: "customer-b" },
  { type: "stock_validated", customer: "customer-b" },
] as const satisfies readonly InventorySimulationEvent[];

const customerBRetryAndCaptureEvents = [
  { type: "retry_started", customer: "customer-b" },
  { type: "lock_requested", customer: "customer-b" },
  { type: "stock_validated", customer: "customer-b" },
  { type: "reservation_created", customer: "customer-b" },
  { type: "transaction_committed", customer: "customer-b" },
  { type: "capture_started", customer: "customer-b" },
  { type: "payment_captured", customer: "customer-b" },
] as const satisfies readonly InventorySimulationEvent[];

export const inventoryScenarioIds = [
  "successful_capture",
  "payment_failure",
  "reservation_expiry",
] as const satisfies readonly InventoryScenarioId[];

export const inventoryScenarios = {
  successful_capture: {
    id: "successful_capture",
    title: "Successful capture",
    summary: "Customer A reserves the final item while Customer B waits and is rejected against the committed hold.",
    outcome: "Verified capture consumes A's reservation and deducts on-hand stock exactly once.",
    events: [
      ...contestedReservationEvents,
      { type: "capture_started", customer: "customer-a" },
      { type: "payment_captured", customer: "customer-a" },
    ],
  },
  payment_failure: {
    id: "payment_failure",
    title: "Payment failure and a new attempt",
    summary: "Customer A's confirmed payment failure releases the hold after Customer B's first checkout was rejected.",
    outcome: "Customer B remains rejected until explicitly starting attempt 2, then reserves and captures the item.",
    events: [
      ...contestedReservationEvents,
      { type: "payment_failed", customer: "customer-a" },
      ...customerBRetryAndCaptureEvents,
    ],
  },
  reservation_expiry: {
    id: "reservation_expiry",
    title: "Safe reservation expiry",
    summary: "Passing the deadline alone leaves Customer A's hold active until provider state is checked and safe release is processed.",
    outcome: "After safe expiry, Customer B explicitly starts attempt 2 and completes the new allocation.",
    events: [
      ...contestedReservationEvents,
      { type: "reservation_deadline_passed", customer: "customer-a" },
      {
        type: "expiry_processed",
        customer: "customer-a",
        providerState: "safe_to_release",
      },
      ...customerBRetryAndCaptureEvents,
    ],
  },
} as const satisfies Record<InventoryScenarioId, InventoryScenario>;

export const replayInventoryEvents = (
  events: readonly InventorySimulationEvent[],
  step = events.length
): InventorySimulationState => {
  if (!Number.isInteger(step) || step < 0 || step > events.length) {
    throw new RangeError(`Replay step must be an integer from 0 to ${events.length}.`);
  }
  return events
    .slice(0, step)
    .reduce(transitionInventorySimulation, createInitialInventorySimulationState());
};

export const replayInventoryScenario = (
  scenarioId: InventoryScenarioId,
  step: number = inventoryScenarios[scenarioId].events.length
) => replayInventoryEvents(inventoryScenarios[scenarioId].events, step);
