# PizzaStore engineering case-study walkthrough

This tour is designed for about two minutes. It describes the implementation and
its evidence without requiring an account or a running API.

## Two-minute tour

**0:00–0:20 — Start with the product.** Open `/docs`. PizzaStore is a multi-store
ordering application. The overview frames three engineering problems: committing
checkout data together, allocating the final tracked item, and keeping staff
authority scoped to a store. Each claim links to its evidence and limitation.

**0:20–0:45 — Establish the boundaries.** Open `/docs/architecture`. The browser,
Express application, PostgreSQL, and the simulator/optional Razorpay Test Mode adapter have distinct responsibilities.
Follow the COD request from middleware through one local transaction, then note
that Socket.IO notification happens after commit and is not durable delivery.

**0:45–1:10 — Follow money and order state.** Open `/docs/order-lifecycle`. Compare
COD creation with online initiation and capture. The diagrams keep the provider
call outside the local transaction, describe repeat-event guards narrowly, and
show cancellation and late-capture limits without implying an automatic refund.

**1:10–1:40 — Contend for the last item.** Open
`/docs/inventory#scenario-explorer`. Step through successful capture. Customer A
holds the row lock only during its transaction, while its reservation persists
after commit. Customer B then reads displayed availability zero and is rejected.
In the failure and safe-expiry scenarios, B must start attempt 2 after release;
the rejected first request never resumes itself.

**1:40–2:00 — End with judgment and evidence.** Open `/docs/decisions` to compare
the current choices with alternatives and accepted costs. Finish at
`/docs/reliability`, where test categories, recovery commands, diagnostic gaps,
and proposed improvements are separated from measured or deployed evidence.

## Interview discussion prompts

1. **Where does atomicity end?** Compare the COD transaction with online payment
   initiation, provider-order attachment, capture finalization, and notification
   after commit. Which failure needs reconciliation, and what evidence would be
   required before claiming stronger delivery guarantees?
2. **What does the last-item explorer prove?** Explain the difference between a
   transaction-scoped row lock, a committed reservation, displayed availability,
   and a real two-connection PostgreSQL contention test. Discuss why the model is
   deterministic and why Customer B needs a new attempt after release.
3. **When should the architecture change?** Use the decision records' revisit
   triggers to discuss when a modular monolith, local logging, in-process realtime
   delivery, or the current store-permission model would stop being sufficient.

## Publication inputs

Before sharing a published project, confirm its actual live/source URLs and hosted SPA fallback, capture a real screenshot, and supply your own contribution/team context. The current [verification record](case-study-verification.md) establishes automated checks on this workspace; it does not establish deployment or browser/provider behavior.
