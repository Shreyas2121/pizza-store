import type { DiagramDefinition } from "../../components/diagram-card";

export const highLevelDesign: DiagramDefinition = {
  title: "PizzaStore / High-level design",
  caption: "One React application, one modular Express backend, and one PostgreSQL database. The financial posting command runs separately using the same backend code.",
  explanation: [
    "Customers, store staff, and admins use the React application. React Router handles navigation, TanStack Query owns server data, and Zustand owns shared client state.",
    "Express authenticates the current user, validates input with Zod, and checks platform or store permissions. Domain services handle catalogue, checkout, promotions, inventory, support, and finance.",
    "Drizzle reads and writes PostgreSQL. Checkout stores authoritative prices and coordinates local order, payment, promotion, and stock changes within a transaction.",
    "Online payments use a configurable provider adapter: the credential-free simulator runs in the backend; Razorpay test mode calls an external provider and verifies signed webhooks.",
    "Financial events are saved in the same transaction as their business changes. A separately invoked posting command claims those events and creates balanced journals. Socket.IO supplies a separate channel for order, stock, and support notifications.",
    "Product and promotion images are served from public local uploads. Expense receipts live in private local storage and are downloaded through an authorized API route.",
  ],
  source: `flowchart TB
    accTitle: PizzaStore high-level architecture
    accDescr: Customers, staff and admins use React. A modular Express API uses PostgreSQL, local files, Socket.IO and a configurable payment provider. A separate posting command reads the financial outbox and writes journals.
    people["Customers / store staff / platform admins"]
    browser["React + TypeScript\nReact Router / TanStack Query / Zustand"]
    people --> browser
    subgraph backend["Express backend — modular monolith"]
      api["REST API\nJWT / current user / Zod / store permissions"]
      domains["Domain services\nCatalogue / checkout / promotions / inventory\nSupport / staff / cash / refunds / expenses / payroll"]
      adapter["Payment provider adapter\nIn-process simulator OR Razorpay test mode"]
      socket["Socket.IO\nSame HTTP server / authorized rooms"]
      api --> domains
      domains --> adapter
      domains -.->|"Notifications"| socket
    end
    postgres[("PostgreSQL via Drizzle\nBusiness records / audit logs\nFinancial outbox / journals / reporting")]
    files["Local file storage\nPublic images / private expense receipts"]
    worker["Financial posting command\nClaim events / retry failures / post journals"]
    razorpay["Razorpay test API\nExternal provider, when configured"]
    browser -->|"REST requests"| api
    socket -.->|"Realtime events"| browser
    domains -->|"SQL and transactions"| postgres
    domains -->|"Upload / authorized download"| files
    worker -->|"Claim outbox rows; write journals"| postgres
    adapter -.->|"Provider API calls"| razorpay
    browser -.->|"Razorpay Checkout, in test mode"| razorpay
    razorpay -.->|"Signed webhook to raw-body handler"| api`,
};

export const financialPosting: DiagramDefinition = {
  title: "Business transaction → financial journal",
  caption: "The database outbox bridges business changes and accounting. Socket notifications do not drive financial posting.",
  explanation: [
    "Order delivery, refunds, cash operations, expenses, and payroll write financial events alongside their business records in a local database transaction.",
    "The posting command claims supported events with a lease. A posting policy translates each event into debit and credit lines; source identities make repeated posting requests idempotent.",
    "The journal starts as a draft. Its lines are inserted before the status changes to posted. PostgreSQL triggers require a balanced journal and prevent changes to posted entries and lines.",
    "A successfully handled event is marked processed. Failed events record their error and become eligible for retry according to the outbox policy. If posting commits before acknowledgment, a retry reuses the existing journal.",
    "Reports read posted journal data. The HTTP server does not automatically run this batch command; an operator or external scheduler must invoke it.",
  ],
  source: `flowchart TB
    accTitle: Transactional financial outbox and journal posting
    accDescr: Business records and an outbox event commit together. A separately invoked worker claims the event, creates a draft journal with balanced lines, posts it and acknowledges the event. Failures can retry.
    action["Business operation\nDelivery / refund / cash / expense / payroll"]
    subgraph transaction["One PostgreSQL transaction"]
      records["Write business records"]
      outbox["Write financial outbox event"]
      records --> outbox
    end
    action --> records
    outbox -->|"After commit"| claim["Posting command claims event with lease"]
    claim --> policy["Posting policy\nValidate source and amounts"]
    policy --> draft["Create draft journal"]
    draft --> lines["Insert debit and credit lines"]
    lines --> post["Post journal\nDatabase verifies balance and protects posted data"]
    post --> ack["Mark event processed"]
    post --> reports["Finance reports / CSV / journal drill-down"]
    policy -.->|"Failure"| retry["Record error and retry\nRepeated source reuses existing journal"]
    retry -.-> claim`,
};

export const systemContext: DiagramDefinition = {
  title: "01 / PizzaStore in its environment",
  caption: "A context view describes people and external systems. Internal storage belongs in the next level of detail.",
  explanation: [
    "Customers browse, customize, and place orders through PizzaStore.",
    "Store staff use assigned-store operations; platform admins manage platform-wide capabilities.",
    "Online payments can use the backend's simulator or external Razorpay test mode. External provider calls are outside PizzaStore's database transaction boundary.",
  ],
  source: `flowchart TB
    accTitle: PizzaStore system context
    accDescr: Customers and staff use PizzaStore, which integrates with external Razorpay payments.
    customer["Customer"] -->|"Browse and order"| system["PizzaStore ordering system"]
    staff["Store staff"] -->|"Assigned-store operations"| system
    admin["Platform admin"] -->|"Platform administration"| system
    system -->|"Create and verify payments, when configured"| provider["Razorpay test mode - external system"]
    provider -->|"Signed payment notifications"| system`,
};

export const containers: DiagramDefinition = {
  title: "02 / Application and data boundaries",
  caption: "Socket.IO is hosted by the application, not a separate external service. These are logical containers, not a claim about a particular hosting topology.",
  explanation: [
    "The React application owns presentation and sends HTTP requests to Express. Socket.IO client and server supply a separate event channel.",
    "Express owns business operations and uses Drizzle to read and write PostgreSQL. Database transactions coordinate local persistent changes.",
    "The configured payment adapter either simulates online payment in the API process or creates and verifies Razorpay test orders. In Razorpay mode, the browser opens provider Checkout and signed webhooks return to the server.",
  ],
  source: `flowchart TB
    accTitle: PizzaStore application containers
    accDescr: React talks to Express by HTTP and Socket.IO; Express uses PostgreSQL and external Razorpay.
    subgraph pizza["PizzaStore system boundary"]
      browser["Browser application - React and Socket.IO client"]
      api["API application - Express, services, Socket.IO server"]
      database[("PostgreSQL")]
      simulator["In-process payment simulator"]
      browser -->|"REST over HTTP"| api
      api -->|"Socket.IO events"| browser
      api -->|"SQL through Drizzle"| database
      api -->|"Simulator mode"| simulator
    end
    provider["Razorpay test mode - optional external provider"]
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
    "Final checkout locks user eligibility, store participation, catalogue rows and promotion rows in the shared order, then resolves automatic offers or a manual coupon against authoritative demand.",
    "The transaction writes a pending COD payment, order and immutable snapshots, tracked stock deductions and movements, consumed promotion applications, and cart clearing. An error aborts those local changes.",
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
    Note over S,D: Validate demand and final offer or manual coupon eligibility
    S->>D: Payment, order, item prices and stock ledger
    S->>D: Consume promotion applications; clear cart
    S->>D: Commit transaction
    D-->>S: Committed result
    S-->>R: Order and low-stock alerts
    R->>E: Emit orderPlaced and applicable lowStock
    R-->>C: JSON response`,
};
