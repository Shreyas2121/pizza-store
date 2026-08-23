-- Reprice the active catalogue from the legacy USD-scale demo values to INR.
-- This migration is idempotent: every target receives a fixed canonical value.
WITH "inr_product_prices" ("slug", "price") AS (
	VALUES
		('margherita-pizza', 299::real),
		('pepperoni-feast', 449::real),
		('bbq-chicken-pizza', 499::real),
		('veggie-supreme', 399::real),
		('farmhouse-pizza', 379::real),
		('meat-lovers-pizza', 549::real),
		('cheese-burst-pizza', 429::real),
		('creamy-alfredo-pasta', 249::real),
		('garlic-breadsticks', 149::real),
		('classic-french-fries', 129::real),
		('grilled-chicken-wings', 299::real),
		('coca-cola', 60::real),
		('fresh-lemonade', 99::real),
		('cold-coffee', 129::real),
		('fruit-punch', 119::real)
)
UPDATE "products" AS "product"
SET
	"price" = "prices"."price",
	"updated_at" = now()
FROM "inr_product_prices" AS "prices"
WHERE "product"."slug" = "prices"."slug";
--> statement-breakpoint

-- Store mappings contain independent price snapshots and must be updated too.
UPDATE "store_products" AS "store_product"
SET
	"price" = "product"."price",
	"updated_at" = now()
FROM "products" AS "product"
WHERE "store_product"."product_id" = "product"."id"
	AND "product"."slug" IN (
		'margherita-pizza',
		'pepperoni-feast',
		'bbq-chicken-pizza',
		'veggie-supreme',
		'farmhouse-pizza',
		'meat-lovers-pizza',
		'cheese-burst-pizza',
		'creamy-alfredo-pasta',
		'garlic-breadsticks',
		'classic-french-fries',
		'grilled-chicken-wings',
		'coca-cola',
		'fresh-lemonade',
		'cold-coffee',
		'fruit-punch'
	);
--> statement-breakpoint

WITH "inr_customization_prices" ("name", "price") AS (
	VALUES
		('Regular', 0::real),
		('Medium', 100::real),
		('Large', 200::real),
		('Hand Tossed', 0::real),
		('Thin Crust', 0::real),
		('Cheese Burst', 120::real),
		('New York Style', 80::real),
		('Extra Cheese', 60::real),
		('Jalapenos', 40::real),
		('Mushrooms', 50::real),
		('Olives', 50::real),
		('Onions', 30::real),
		('Paneer', 70::real),
		('Grilled Chicken', 90::real)
)
UPDATE "customization_options" AS "customization"
SET
	"price" = "prices"."price",
	"updated_at" = now()
FROM "inr_customization_prices" AS "prices"
WHERE "customization"."name" = "prices"."name";
--> statement-breakpoint

-- Carts are mutable snapshots. Refresh them so carts created before this
-- migration cannot retain legacy prices after the catalogue changes.
UPDATE "cart_items" AS "cart_item"
SET
	"price" = COALESCE(
		(
			SELECT "store_product"."price"
			FROM "cart" AS "cart_row"
			INNER JOIN "store_products" AS "store_product"
				ON "store_product"."store_id" = "cart_row"."store_id"
			WHERE "cart_row"."id" = "cart_item"."cart_id"
				AND "store_product"."product_id" = "cart_item"."product_id"
			LIMIT 1
		),
		(
			SELECT "product"."price"
			FROM "products" AS "product"
			WHERE "product"."id" = "cart_item"."product_id"
		)
	),
	"updated_at" = now()
WHERE EXISTS (
	SELECT 1
	FROM "products" AS "product"
	WHERE "product"."id" = "cart_item"."product_id"
);
--> statement-breakpoint

UPDATE "cart_item_customizations" AS "cart_customization"
SET
	"price" = "customization"."price",
	"updated_at" = now()
FROM "customization_options" AS "customization"
WHERE "cart_customization"."customization_option_id" = "customization"."id";
--> statement-breakpoint

UPDATE "cart" AS "cart_row"
SET
	"total_price" = COALESCE(
		(
			SELECT SUM(
				(
					"cart_item"."price" + COALESCE(
						(
							SELECT SUM("cart_customization"."price")
							FROM "cart_item_customizations" AS "cart_customization"
							WHERE "cart_customization"."cart_item_id" = "cart_item"."id"
						),
						0
					)
				) * "cart_item"."quantity"
			)
			FROM "cart_items" AS "cart_item"
			WHERE "cart_item"."cart_id" = "cart_row"."id"
		),
		0
	),
	"updated_at" = now();
