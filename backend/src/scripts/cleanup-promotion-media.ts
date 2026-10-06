import { closeDatabase } from "../db";
import promotionService from "../features/promotions/promotion.service";

async function main() {
  try {
    const removed = await promotionService.cleanupMedia();
    console.info(
      `Removed ${removed.length} unreferenced promotion images older than the retention window.`,
    );
  } finally {
    await closeDatabase();
  }
}
void main().catch(() => {
  console.error("Promotion media cleanup failed.");
  process.exitCode = 1;
});
