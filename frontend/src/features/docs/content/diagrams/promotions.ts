import type { DiagramDefinition } from "../../components/diagram-card";

export const promotionsLifecycle: DiagramDefinition = {
  title: "Promotions / Discovery to store revenue",
  caption: "Discovery and validation are advisory. Final checkout locks and reprices; saved online orders retain captured amounts through recovery.",
  explanation: [
    "Platform admins own global definitions and media. Active same-store managers can opt their store out; no setting means enabled.",
    "Quotes resolve automatic offers or one manually entered coupon. Any offer or deal bundle blocks coupons. Bundle compare-at savings are display metadata.",
    "COD consumes applications in local creation. Online creation reserves exact usage/budget; verified capture consumes it once, and failure releases it.",
    "Delivery publishes an immutable financial event. Store item discounts use 4100; waived delivery is zero revenue, and platform reports sum store journals once.",
    "Offline tests and fixture reconciliation exercise these paths. PostgreSQL races, empty-database seed and browser/provider walkthroughs remain unrun.",
  ],
  source: `flowchart TD
    accTitle: Promotion discovery, pricing, payment and revenue
    accDescr: Public discovery leads to an authoritative quote, local application reservation or consumption, payment recovery, immutable order snapshots and store ledger reporting.
    platform["Platform definitions and media"] --> discovery["Store offer discovery - no hidden codes"]
    manager["Same-store manager participation"] --> discovery
    discovery --> quote["Authoritative quote - automatic offers OR manual coupon"]
    manual["Customer enters coupon manually"] --> quote
    bundle["Catalogue bundle selling price and components"] --> quote
    quote --> final["Final locked checkout - re-evaluate"]
    final --> cod["COD consumes applications"]
    final --> online["Online reserves exact capacity and budget"]
    online --> provider["Provider outside SQL transaction"]
    provider --> capture["Verified capture consumes once"]
    provider --> failure["Failure releases reservations"]
    failure --> retry["Retry restores saved inventory and promotion capacity"]
    retry --> provider
    cod --> snapshot["Immutable order and allocation snapshots"]
    capture --> snapshot
    snapshot --> delivery["Delivery event and balanced store journal"]
    delivery --> ledger["4000 sales - 4100 item discount; waived delivery zero"]
    ledger --> reports["Platform sums store journals once"]`,
};
