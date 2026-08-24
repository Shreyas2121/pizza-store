import { closeDatabase } from "../db";
import paymentService from "../features/payments/payment.service";

const parseBoundedInteger = (
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string
) => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
};

const run = async () => {
  const limit = parseBoundedInteger(
    process.env.RECONCILE_LIMIT,
    25,
    1,
    100,
    "RECONCILE_LIMIT"
  );

  const result = await paymentService.reconcileExpiredReservations(limit);
  console.log(JSON.stringify(result, null, 2));
  if (result.errors > 0) process.exitCode = 1;
};

run()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Reservation reconciliation failed"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
