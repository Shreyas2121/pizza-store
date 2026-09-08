import { describe, expect, it } from "vitest";
import {
  createInitialInventorySimulationState,
  inspectInventorySimulationInvariants,
  inventoryScenarioIds,
  inventoryScenarios,
  InventorySimulationTransitionError,
  replayInventoryScenario,
  transitionInventorySimulation,
  type InventoryScenarioId,
  type InventorySimulationEvent,
} from "./inventory-simulation";

const stepAfter = (
  scenarioId: InventoryScenarioId,
  type: InventorySimulationEvent["type"]
) => {
  const index = inventoryScenarios[scenarioId].events.findIndex(
    (event) => event.type === type
  );
  if (index < 0) throw new Error(`${scenarioId} has no ${type} event`);
  return index + 1;
};

describe("inventory simulation invariants", () => {
  it("never allocates the single item to both customers", () => {
    for (const scenarioId of inventoryScenarioIds) {
      const events = inventoryScenarios[scenarioId].events;
      for (let step = 0; step <= events.length; step += 1) {
        expect(inspectInventorySimulationInvariants(replayInventoryScenario(scenarioId, step))).toEqual({
          quantitiesAreNonNegativeIntegers: true,
          availabilityMatchesReservations: true,
          atMostOneCustomerIsAllocated: true,
          lockOwnerIsNotWaiting: true,
        });
      }
    }
  });

  it("keeps a committed reservation after the transaction lock is released", () => {
    const state = replayInventoryScenario(
      "successful_capture",
      stepAfter("successful_capture", "transaction_committed")
    );

    expect(state.lock.owner).toBeNull();
    expect(state.reservations["customer-a"].status).toBe("reserved");
    expect(state.inventory).toMatchObject({
      onHandQuantity: 1,
      reservedQuantity: 1,
      availableQuantity: 0,
    });
  });

  it("consumes the reservation and deducts on-hand stock once", () => {
    const captured = replayInventoryScenario("successful_capture");
    const replayedCapture = transitionInventorySimulation(captured, {
      type: "payment_captured",
      customer: "customer-a",
    });

    expect(captured.reservations["customer-a"].status).toBe("consumed");
    expect(captured.payments["customer-a"]).toBe("captured");
    expect(captured.inventory).toMatchObject({
      onHandQuantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
    });
    expect(replayedCapture.inventory).toEqual(captured.inventory);
    expect(replayedCapture.reservations).toEqual(captured.reservations);
    expect(
      replayedCapture.history[replayedCapture.history.length - 1]?.description
    ).toContain(
      "not deducted again"
    );
  });
});

describe("release, expiry, and retry behavior", () => {
  it("releases a failed payment hold without resuming a rejected checkout", () => {
    const released = replayInventoryScenario(
      "payment_failure",
      stepAfter("payment_failure", "payment_failed")
    );

    expect(released.reservations["customer-a"].status).toBe("released");
    expect(released.payments["customer-a"]).toBe("failed");
    expect(released.customers["customer-a"].checkoutStatus).toBe(
      "payment_failed"
    );
    expect(released.inventory).toMatchObject({
      onHandQuantity: 1,
      reservedQuantity: 0,
      availableQuantity: 1,
    });
    expect(released.customers["customer-b"]).toMatchObject({
      attempts: 1,
      checkoutStatus: "rejected",
    });

    const retry = transitionInventorySimulation(released, {
      type: "retry_started",
      customer: "customer-b",
    });
    expect(retry.customers["customer-b"]).toMatchObject({
      attempts: 2,
      checkoutStatus: "in_transaction",
    });

    const completedRetry = replayInventoryScenario("payment_failure");
    expect(completedRetry.payments["customer-b"]).toBe("captured");
    expect(completedRetry.inventory.onHandQuantity).toBe(0);
  });

  it("keeps an overdue reservation active until safe expiry is processed", () => {
    const overdue = replayInventoryScenario(
      "reservation_expiry",
      stepAfter("reservation_expiry", "reservation_deadline_passed")
    );
    expect(overdue.reservations["customer-a"]).toMatchObject({
      status: "reserved",
      deadlinePassed: true,
    });
    expect(overdue.inventory.availableQuantity).toBe(0);

    const released = replayInventoryScenario(
      "reservation_expiry",
      stepAfter("reservation_expiry", "expiry_processed")
    );
    expect(released.reservations["customer-a"].status).toBe("released");
    expect(released.payments["customer-a"]).toBe("failed");
    expect(released.customers["customer-a"].checkoutStatus).toBe(
      "cancelled_after_expiry"
    );
    expect(released.inventory).toMatchObject({
      onHandQuantity: 1,
      reservedQuantity: 0,
      availableQuantity: 1,
    });
    expect(() =>
      transitionInventorySimulation(released, {
        type: "capture_started",
        customer: "customer-a",
      })
    ).toThrowError(InventorySimulationTransitionError);

    const completedRetry = replayInventoryScenario("reservation_expiry");
    expect(completedRetry.payments["customer-b"]).toBe("captured");
    expect(completedRetry.inventory.onHandQuantity).toBe(0);
  });
});

describe("deterministic replay", () => {
  it("returns initial state for step zero and the same state for every replay", () => {
    expect(replayInventoryScenario("successful_capture", 0)).toEqual(
      createInitialInventorySimulationState()
    );

    for (const scenarioId of inventoryScenarioIds) {
      const events = inventoryScenarios[scenarioId].events;
      for (let step = 0; step <= events.length; step += 1) {
        const firstReplay = replayInventoryScenario(scenarioId, step);
        const secondReplay = replayInventoryScenario(scenarioId, step);
        expect(secondReplay).not.toBe(firstReplay);
        expect(secondReplay).toEqual(firstReplay);
      }
    }
  });

  it("rejects invalid events and replay positions explicitly", () => {
    expect(() =>
      transitionInventorySimulation(createInitialInventorySimulationState(), {
        type: "payment_captured",
        customer: "customer-a",
      })
    ).toThrowError(InventorySimulationTransitionError);
    expect(() => replayInventoryScenario("successful_capture", -1)).toThrow(
      RangeError
    );
  });
});
