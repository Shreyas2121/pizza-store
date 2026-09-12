import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, unique } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { promotionsTable } from "./promotion.schema";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";

export const storePromotionSettingsTable = pgTable(
  "store_promotion_settings",
  {
    id,
    promotionId: integer("promotion_id")
      .references(() => promotionsTable.id, { onDelete: "cascade" })
      .notNull(),
    storeId: integer("store_id")
      .references(() => storesTable.id, { onDelete: "cascade" })
      .notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    updatedByUserId: integer("updated_by_user_id")
      .references(() => usersTable.id)
      .notNull(),
    disabledReason: text("disabled_reason"),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("store_promotion_settings_promotion_store_unique").on(
      table.promotionId,
      table.storeId
    ),
    index("store_promotion_settings_store_enabled_idx").on(
      table.storeId,
      table.isEnabled,
      table.promotionId
    ),
    check(
      "store_promotion_settings_reason_valid",
      sql`${table.disabledReason} is null or (
        nullif(btrim(${table.disabledReason}), '') is not null
        and char_length(${table.disabledReason}) <= 500
      )`
    ),
  ]
);
