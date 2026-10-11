import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDirectory } from "../utils/storage-paths";
import { and, eq } from "drizzle-orm";
import { checkDatabaseConnection, closeDatabase, db } from "../db";
import { bundleComponentsTable, menuItemsMappingTable, menuItemsTable, productsTable, promotionsTable,
  promotionRulesTable, storeProductsTable, storePromotionSettingsTable, storesTable, usersTable } from "../db/schema";
import { definitionToValues, rulesToValues } from "../features/promotions/promotion.mapper";
import { PROMOTION_MEDIA_DIRECTORY, PROMOTION_MEDIA_LIFECYCLE_LOCK_NAME, PROMOTION_MEDIA_URL_PREFIX } from "../features/promotions";
import { sql } from "drizzle-orm";
import { promotionFixtureArtwork } from "../fixtures/promotion-media.fixtures";
import { promotionFixtures, PROMOTION_FIXTURE_BUNDLE, PROMOTION_FIXTURE_MEDIA, PROMOTION_FIXTURE_OPT_OUT_NAME,
  PROMOTION_FIXTURE_OPT_OUT_REASON, PROMOTION_FIXTURE_DATE } from "../fixtures/promotions.fixtures";

export async function seedPromotions() {
  return db.transaction(async (tx) => {
    // Same lock as uploads/cleanup; a failed transaction leaves unreferenced assets for normal cleanup.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${PROMOTION_MEDIA_LIFECYCLE_LOCK_NAME}))`);
    const [admin] = await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin")).orderBy(usersTable.id).limit(1);
    const products = await tx.select().from(productsTable);
    const pizza = products.find((p) => p.slug === "margherita-pizza");
    const drink = products.find((p) => p.slug === "coca-cola");
    if (!admin || !pizza || !drink) throw new Error("Promotion seed requires an admin and the seeded pizza/drink catalogue.");
    const stores = await tx.select().from(storesTable).orderBy(storesTable.id);
    if (stores.length === 0) throw new Error("Promotion seed requires a store.");

    const [insertedBundle] = await tx.insert(productsTable).values({
      name: PROMOTION_FIXTURE_BUNDLE.name, slug: PROMOTION_FIXTURE_BUNDLE.slug,
      description: PROMOTION_FIXTURE_BUNDLE.description, pricePaise: PROMOTION_FIXTURE_BUNDLE.pricePaise,
      image: PROMOTION_FIXTURE_BUNDLE.image,
      categoryId: pizza.categoryId, productType: "bundle", hasCustomization: false, veg: true,
    }).onConflictDoNothing({ target: productsTable.slug }).returning();
    const bundle = insertedBundle ?? products.find((p) => p.slug === PROMOTION_FIXTURE_BUNDLE.slug);
    if (!bundle || bundle.productType !== "bundle") throw new Error("Demo combo slug conflicts with a non-bundle product.");
    await tx.insert(bundleComponentsTable).values([
      { bundleProductId: bundle.id, componentProductId: pizza.id, quantity: 1 },
      { bundleProductId: bundle.id, componentProductId: drink.id, quantity: 1 },
    ]).onConflictDoNothing();
    await tx.insert(storeProductsTable).values(stores.map((store) => ({
      storeId: store.id, productId: bundle.id, pricePaise: PROMOTION_FIXTURE_BUNDLE.pricePaise,
      compareAtPricePaise: PROMOTION_FIXTURE_BUNDLE.compareAtPricePaise, isAvailable: true,
      // Bundle inventory is derived from component rows, never a separate stock pool.
      onHandQuantity: null,
    }))).onConflictDoNothing();
    const [menu] = await tx.select({ id: menuItemsTable.id }).from(menuItemsTable).where(eq(menuItemsTable.slug, "pizzas")).limit(1);
    if (menu) {
      // This legacy junction has no unique constraint; the shared seed lock serializes this existence check.
      const existingMappings = await tx.select().from(menuItemsMappingTable)
        .where(and(eq(menuItemsMappingTable.menuItemId, menu.id), eq(menuItemsMappingTable.productId, bundle.id)));
      if (existingMappings.length === 0) await tx.insert(menuItemsMappingTable).values({ menuItemId: menu.id, productId: bundle.id });
    }

    const definitions = promotionFixtures({ pizzaId: pizza.id, pizzaCategoryId: pizza.categoryId });
    let created = 0;
    for (const definition of definitions) {
      const [existing] = await tx.select({ id: promotionsTable.id }).from(promotionsTable)
        .where(and(eq(promotionsTable.name, definition.name), eq(promotionsTable.kind, definition.kind))).limit(1);
      if (existing) continue; // Never rewrite definition versions, applications, media or store choices.
      const media = definition.display.showOnHomepage;
      const primaryArtwork = definition.name === PROMOTION_FIXTURE_OPT_OUT_NAME;
      if (media) {
        await mkdir(path.resolve(dataDirectory(), PROMOTION_MEDIA_DIRECTORY), { recursive: true });
        const variants: ("desktop" | "mobile")[] = primaryArtwork ? ["desktop", "mobile"] : ["desktop"];
        for (const variant of variants) {
          const bytes = await promotionFixtureArtwork(variant, primaryArtwork ? "percentage" : "fixed_amount");
          const filename = primaryArtwork ? PROMOTION_FIXTURE_MEDIA[variant] : PROMOTION_FIXTURE_MEDIA.fallbackDesktop;
          const target = path.resolve(dataDirectory(), PROMOTION_MEDIA_DIRECTORY, filename);
          try { await writeFile(target, bytes, { flag: "wx" }); }
          catch (cause) {
            if (!(cause instanceof Error && "code" in cause && cause.code === "EEXIST")) throw cause;
            const stat = await lstat(target);
            if (!stat.isFile() || stat.isSymbolicLink() || !(await readFile(target)).equals(bytes)) {
              throw new Error("Fixture media path contains a different file; existing artwork was preserved.");
            }
          }
        }
      }
      const [row] = await tx.insert(promotionsTable).values({ ...definitionToValues(definition),
        createdAt: PROMOTION_FIXTURE_DATE, updatedAt: PROMOTION_FIXTURE_DATE,
        imageUrl: media ? `${PROMOTION_MEDIA_URL_PREFIX}${primaryArtwork ? PROMOTION_FIXTURE_MEDIA.desktop : PROMOTION_FIXTURE_MEDIA.fallbackDesktop}` : null,
        mobileImageUrl: media && primaryArtwork ? `${PROMOTION_MEDIA_URL_PREFIX}${PROMOTION_FIXTURE_MEDIA.mobile}` : null,
        imageAlt: media ? (primaryArtwork ? PROMOTION_FIXTURE_MEDIA.alt : "Demo pizza offer: save 20 rupees on base price. Checkout confirms eligibility.") : null,
      }).returning({ id: promotionsTable.id });
      const rules = rulesToValues(row.id, definition.rules);
      if (rules.length) await tx.insert(promotionRulesTable).values(rules);
      const optOutStore = stores.find((s) => s.slug === "pizzastore-bengaluru-south");
      if (definition.name === PROMOTION_FIXTURE_OPT_OUT_NAME && optOutStore) {
        await tx.insert(storePromotionSettingsTable).values({ promotionId: row.id, storeId: optOutStore.id,
          isEnabled: false, disabledReason: PROMOTION_FIXTURE_OPT_OUT_REASON, updatedByUserId: admin.id,
          createdAt: PROMOTION_FIXTURE_DATE, updatedAt: PROMOTION_FIXTURE_DATE });
      }
      created += 1;
    }
    return { created, totalFixtures: definitions.length, bundleProductId: bundle.id };
  });
}

if (require.main === module) {
  (async () => {
    if (!await checkDatabaseConnection()) throw new Error("Promotion seed requires a healthy database connection.");
    console.log(await seedPromotions());
  })().catch((cause) => { console.error(cause); process.exitCode = 1; }).finally(() => closeDatabase());
}
