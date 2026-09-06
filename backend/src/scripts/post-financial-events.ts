import { randomUUID } from "crypto";
import { closeDatabase } from "../db";
import { commercePostingWorker } from "../features/finance-events/commerce-posting.runtime";

const run = async () => {
  const workerId = `commerce-ledger-${process.pid}-${randomUUID()}`;
  const result = await commercePostingWorker.runOnce(workerId, 100);
  console.log(JSON.stringify(result));
};

run()
  .catch((cause) => {
    console.error(cause instanceof Error ? cause.message : "Financial posting worker failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => undefined);
  });
