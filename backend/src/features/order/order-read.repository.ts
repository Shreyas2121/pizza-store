import { asc } from "drizzle-orm";
import { orderItemsTable, promotionApplicationsTable, promotionDiscountAllocationsTable } from "../../db/schema";

// The relational query loads the full result set's snapshots without N+1 reads.
// Only the current image is decoration; all historical names are saved.
export const ORDER_SNAPSHOT_RELATIONS = {
  promotionApplications: {
    orderBy: asc(promotionApplicationsTable.promotionId),
    with: { allocations: { orderBy: asc(promotionDiscountAllocationsTable.id) } },
  },
  items: {
    orderBy: asc(orderItemsTable.id),
    with: {
      product: { columns: { image: true } },
      orderItemCustomizations: true,
      bundleComponents: true,
    },
  },
} as const;
