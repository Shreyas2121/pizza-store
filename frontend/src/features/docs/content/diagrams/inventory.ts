import type { DiagramDefinition } from "../../components/diagram-card";

export const inventoryStateModel: DiagramDefinition = {
  title: "01 / Availability has separate inputs",
  caption: "A manual sales gate and a stock calculation answer different questions. Checkout applies both.",
  explanation: [
    "Product and store-product availability flags can stop sale independently of inventory tracking.",
    "A null on-hand quantity means the item is untracked, so numeric availability is also null.",
    "For tracked stock, displayed availability is the non-negative difference between on-hand and all rows whose status is reserved.",
    "Checkout aggregates every customized cart line by base product, then validates the combined demand inside the transaction.",
  ],
  source: `flowchart LR
    accTitle: Inventory availability inputs
    accDescr: Manual product flags gate checkout, while tracked stock subtracts active reservations and untracked stock has no numeric availability.
    product["Product available?"] --> gate{"Manual sales gate"}
    store["Available at this store?"] --> gate
    gate -->|"No"| reject["Reject unavailable item"]
    gate -->|"Yes"| tracked{"On-hand is null?"}
    tracked -->|"Yes - untracked"| unlimited["Numeric availability = null"]
    tracked -->|"No - tracked"| formula["Displayed = max(0, on-hand - reserved)"]
    formula --> demand["Validate aggregated base-product demand"]
    unlimited --> demand`,
};

export const lastItemSequence: DiagramDefinition = {
  title: "02 / Two checkouts request the final item",
  caption: "The row lock ends at commit. Customer A's reservation remains as persistent state and is what customer B sees next.",
  wide: true,
  explanation: [
    "The item starts with on-hand 1, reserved 0, and displayed availability 1.",
    "Customer A locks the store-product row. Customer B's transaction waits for that same row rather than validating from an earlier unlocked stock value.",
    "A reads active reservations, validates demand 1, inserts a reservation for 1, and commits. The database releases A's row lock at commit.",
    "The reservation survives that commit. B then acquires the row lock, reads reserved 1, calculates displayed availability 0, and receives an insufficient-stock conflict.",
    "If A later captures payment, another transaction consumes the reservation and changes on-hand from 1 to 0 once. If A's hold is safely released, B needs a new checkout attempt.",
  ],
  source: `sequenceDiagram
    accTitle: Serialized allocation of the final tracked item
    accDescr: Customer A reserves the last item while customer B waits for the stock row lock, then B observes zero availability.
    participant A as Customer A transaction
    participant D as PostgreSQL
    participant B as Customer B transaction
    Note over A,B: Initial: on-hand 1, reserved 0, displayed 1
    A->>D: Lock store-product row FOR UPDATE
    D-->>A: Lock granted
    B->>D: Lock the same store-product row
    Note over B,D: B waits while A owns the transaction lock
    A->>D: Read reserved = 0; validate demand = 1
    A->>D: Insert persistent reservation = 1
    A->>D: Commit
    Note over A,D: A's row lock is released; reservation remains
    D-->>B: Lock granted
    B->>D: Read reserved = 1
    Note over B,D: displayed = max(0, 1 - 1) = 0
    D-->>B: Reject new allocation: insufficient stock
    B->>D: Roll back`,
};
