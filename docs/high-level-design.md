# PizzaStore — high-level design

The portfolio view is public at `/docs/architecture#high-level-design`. The storefront footer links to it through **Engineering case study**. Reviewed against the local source on 10 October 2026.

## System overview

One React application, one modular Express backend, and one PostgreSQL database. The financial posting command runs separately using the same backend code.

```mermaid
flowchart TB
    accTitle: PizzaStore high-level architecture
    accDescr: Customers, staff and admins use React. A modular Express API uses PostgreSQL, local files, Socket.IO and a configurable payment provider. A separate posting command reads the financial outbox and writes journals.
    people["Customers / store staff / platform admins"]
    browser["React + TypeScript
React Router / TanStack Query / Zustand"]
    people --> browser
    subgraph backend["Express backend — modular monolith"]
      api["REST API
JWT / current user / Zod / store permissions"]
      domains["Domain services
Catalogue / checkout / promotions / inventory
Support / staff / cash / refunds / expenses / payroll"]
      adapter["Payment provider adapter
In-process simulator OR Razorpay test mode"]
      socket["Socket.IO
Same HTTP server / authorized rooms"]
      api --> domains
      domains --> adapter
      domains -.->|"Notifications"| socket
    end
    postgres[("PostgreSQL via Drizzle
Business records / audit logs
Financial outbox / journals / reporting")]
    files["Local file storage
Public images / private expense receipts"]
    worker["Financial posting command
Claim events / retry failures / post journals"]
    razorpay["Razorpay test API
External provider, when configured"]
    browser -->|"REST requests"| api
    socket -.->|"Realtime events"| browser
    domains -->|"SQL and transactions"| postgres
    domains -->|"Upload / authorized download"| files
    worker -->|"Claim outbox rows; write journals"| postgres
    adapter -.->|"Provider API calls"| razorpay
    browser -.->|"Razorpay Checkout, in test mode"| razorpay
    razorpay -.->|"Signed webhook to raw-body handler"| api
```

- Customers, store staff, and admins use the React application. React Router handles navigation, TanStack Query owns server data, and Zustand owns shared client state.
- Express authenticates the current user, validates input with Zod, and checks platform or store permissions. Domain services handle catalogue, checkout, promotions, inventory, support, and finance.
- Drizzle reads and writes PostgreSQL. Checkout stores authoritative prices and coordinates local order, payment, promotion, and stock changes within a transaction.
- Online payments use a configurable provider adapter: the credential-free simulator runs in the backend; Razorpay test mode calls an external provider and verifies signed webhooks.
- Financial events are saved in the same transaction as their business changes. A separately invoked posting command claims those events and creates balanced journals. Socket.IO supplies a separate channel for order, stock, and support notifications.
- Product and promotion images are served from public local uploads. Expense receipts live in private local storage and are downloaded through an authorized API route.

## Financial posting

The database outbox bridges business changes and accounting. Socket notifications do not drive financial posting.

```mermaid
flowchart TB
    accTitle: Transactional financial outbox and journal posting
    accDescr: Business records and an outbox event commit together. A separately invoked worker claims the event, creates a draft journal with balanced lines, posts it and acknowledges the event. Failures can retry.
    action["Business operation
Delivery / refund / cash / expense / payroll"]
    subgraph transaction["One PostgreSQL transaction"]
      records["Write business records"]
      outbox["Write financial outbox event"]
      records --> outbox
    end
    action --> records
    outbox -->|"After commit"| claim["Posting command claims event with lease"]
    claim --> policy["Posting policy
Validate source and amounts"]
    policy --> draft["Create draft journal"]
    draft --> lines["Insert debit and credit lines"]
    lines --> post["Post journal
Database verifies balance and protects posted data"]
    post --> ack["Mark event processed"]
    post --> reports["Finance reports / CSV / journal drill-down"]
    policy -.->|"Failure"| retry["Record error and retry
Repeated source reuses existing journal"]
    retry -.-> claim
```

- Order delivery, refunds, cash operations, expenses, and payroll write financial events alongside their business records in a local database transaction.
- The posting command claims supported events with a lease. A posting policy translates each event into debit and credit lines; source identities make repeated posting requests idempotent.
- The journal starts as a draft. Its lines are inserted before the status changes to posted. PostgreSQL triggers require a balanced journal and prevent changes to posted entries and lines.
- A successfully handled event is marked processed. Failed events record their error and become eligible for retry according to the outbox policy. If posting commits before acknowledgment, a retry reuses the existing journal.
- Reports read posted journal data. The HTTP server does not automatically run this batch command; an operator or external scheduler must invoke it.

## Design choices to discuss

- **Modular monolith:** local checkout changes can commit together; modules share a process and release boundary.
- **Server-owned pricing:** persisted order snapshots preserve selling prices, discounts, and demo tax after catalogue changes.
- **Store-level authorization:** platform roles and store memberships are checked on the server; UI visibility follows those permissions.
- **Payment adapter:** the simulator makes the portfolio usable without provider credentials; Razorpay test mode exercises an external boundary.
- **Transactional financial outbox:** business writes and their financial events commit together; posting is retriable and source identities prevent duplicate journals.
- **Immutable posted journals:** drafts receive their lines before posting; PostgreSQL triggers verify balance and protect posted records.
- **Separate realtime channel:** Socket.IO improves responsiveness; reconnecting clients still read authoritative state through the API.
- **Local file storage:** public food photos and private receipts have different access paths. A deployment with multiple API instances would need shared storage and a shared Socket.IO adapter.

## Diagram exports

The existing [SVG](architecture.svg) and [PNG](architecture.png) are presentation exports. The Markdown and website Mermaid sources are the maintainable descriptions; regenerate exports when their component boundaries change.

## Portfolio presentation

A diagram is useful supporting evidence, but it is not required to use the product. Link **Live demo**, **Architecture**, and **Source code** from the portfolio project card. Start a walkthrough with this overview, then show the checkout sequence, last-item inventory scenario, and financial posting. Keep implementation details on the public case-study pages so recruiters can choose their level of detail.

These views describe logical components rather than a particular hosting provider or deployment topology. The posting worker is a separately invoked batch command, not an automatic background loop in the HTTP server. Money is integer paise; configured tax rules and payment history are portfolio demonstration data.

The website diagram source lives in `frontend/src/features/docs/content/diagrams/architecture.ts`. Keep this Markdown view synchronized when those boundaries change.
