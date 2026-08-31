ALTER TABLE "order_item_customizations" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "price" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_amount" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total_price" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total_price" DROP NOT NULL;