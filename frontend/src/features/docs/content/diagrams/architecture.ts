import type { DiagramDefinition } from "../../components/diagram-card";

export const systemContext: DiagramDefinition = {
  title: "01 / PizzaStore in its environment",
  caption: "A context view describes people and external systems. Internal storage belongs in the next level of detail.",
  explanation: [
    "Customers browse, customize, and place orders through PizzaStore.",
    "Store staff use assigned-store operations; platform admins manage platform-wide capabilities.",
    "PizzaStore initiates online payments with Razorpay and receives provider notifications. Razorpay is outside PizzaStore's database transaction boundary.",
  ],
  source: `flowchart TB
    accTitle: PizzaStore system context
    accDescr: Customers and staff use PizzaStore, which integrates with external Razorpay payments.
    customer["Customer"] -->|"Browse and order"| system["PizzaStore ordering system"]
    staff["Store staff"] -->|"Assigned-store operations"| system
    admin["Platform admin"] -->|"Platform administration"| system
    system -->|"Create and verify payments"| provider["Razorpay - external system"]
    provider -->|"Signed payment notifications"| system`,
};

export const containers: DiagramDefinition = {
  title: "02 / Application and data boundaries",
  caption: "Socket.IO is hosted by the application, not a separate external service. These are logical containers, not a claim about a particular hosting topology.",
  explanation: [
    "The React application owns presentation and sends HTTP requests to Express. Socket.IO client and server supply a separate event channel.",
    "Express owns business operations and uses Drizzle to read and write PostgreSQL. Database transactions coordinate local persistent changes.",
    "The server creates and verifies provider orders with Razorpay; the browser opens provider Checkout. Signed webhooks return to the server.",
  ],
  source: `flowchart TB
    accTitle: PizzaStore application containers
    accDescr: React talks to Express by HTTP and Socket.IO; Express uses PostgreSQL and external Razorpay.
    subgraph pizza["PizzaStore system boundary"]
      browser["Browser application - React and Socket.IO client"]
      api["API application - Express, services, Socket.IO server"]
      database[("PostgreSQL")]
      browser -->|"REST over HTTP"| api
      api -->|"Socket.IO events"| browser
      api -->|"SQL through Drizzle"| database
    end
    provider["Razorpay - external"]
    browser -->|"Provider Checkout"| provider
    api -->|"Create and fetch provider state"| provider
    provider -->|"Signed HTTP webhooks"| api`,
};

export const codRequest: DiagramDefinition = {
  title: "03 / One COD request, through the system",
  caption: "The transaction completes before route-level notifications. An emitted event is not part of the database commit.",
  wide: true,
  explanation: [
    "POST /api/v1/order passes through body parsing, CORS, request logging, JWT/current-user authentication, and create-order body validation.",
    "OrderService opens a transaction. Checkout locks the cart, checks store hours, address ownership and delivery zone, then checks manual availability.",
    "The quote locks stock rows in ascending ID order, reads reservations, validates aggregate demand, and locks/validates an optional coupon.",
    "The transaction writes a pending COD payment, order and price snapshots, tracked stock deductions and movement entries, optional coupon consumption, and cart clearing. An error aborts those local changes.",
    "After commit, the route emits orderPlaced and applicable lowStock notifications, then returns JSON. A process failure after commit can still interrupt notification delivery.",
  ],
  source: `sequenceDiagram
    accTitle: COD request lifecycle
    accDescr: Middleware validates a request, OrderService commits local checkout changes, then the route emits notifications and responds.
    participant C as Customer browser
    participant R as Express route
    participant S as Order and checkout services
    participant D as PostgreSQL
    participant E as Socket.IO server
    C->>R: POST /api/v1/order
    Note over R: Parse body, CORS, log request
    R->>D: Authenticate JWT and load current principal
    D-->>R: Active principal and token version
    Note over R: Validate createOrderSchema
    R->>S: createOrder(userId, addressId, couponCode)
    S->>D: Begin transaction; lock cart
    Note over S,D: Check store, hours, address and zone; manual availability
    S->>D: Lock stock by ascending ID; read reservations
    Note over S,D: Validate demand; lock and validate optional coupon
    S->>D: Payment, order, item prices and stock ledger
    S->>D: Consume optional coupon; clear cart
    S->>D: Commit transaction
    D-->>S: Committed result
    S-->>R: Order and low-stock alerts
    R->>E: Emit orderPlaced and applicable lowStock
    R-->>C: JSON response`,
};
