import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import {
  inventoryCustomerIds,
  inventoryScenarioIds,
  inventoryScenarios,
  replayInventoryScenario,
  type CheckoutStatus,
  type InventoryCustomerId,
  type InventoryScenarioId,
  type PaymentOutcome,
  type ReservationStatus,
} from "./inventory-simulation";

const checkoutStatusLabels: Record<CheckoutStatus, string> = {
  idle: "Not started",
  in_transaction: "Checkout transaction active",
  waiting_for_lock: "Waiting for stock lock",
  reservation_committed: "Reservation committed",
  rejected: "Checkout rejected",
  finalizing: "Capture finalizing",
  payment_failed: "Payment failed",
  cancelled_after_expiry: "Order cancelled after expiry",
  completed: "Checkout completed",
};

const reservationStatusLabels: Record<ReservationStatus, string> = {
  none: "No reservation",
  reserved: "Reserved",
  consumed: "Consumed",
  released: "Released",
};

const paymentOutcomeLabels: Record<PaymentOutcome, string> = {
  not_started: "Not started",
  pending: "Pending",
  captured: "Captured",
  failed: "Failed",
};

const eventLabel = (type: string) =>
  type.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());

const customerShortLabel = (customer: InventoryCustomerId) =>
  customer === "customer-a" ? "Customer A" : "Customer B";

export function InventorySimulator() {
  const [scenarioId, setScenarioId] = useState<InventoryScenarioId>(
    "successful_capture"
  );
  const [step, setStep] = useState(0);
  const scenario = inventoryScenarios[scenarioId];
  const state = replayInventoryScenario(scenarioId, step);
  const completedScenario = replayInventoryScenario(scenarioId);
  const lastHistoryEntry = state.history[state.history.length - 1];
  const statusText = lastHistoryEntry
    ? `Step ${step} of ${scenario.events.length}. ${lastHistoryEntry.description}`
    : `Step 0 of ${scenario.events.length}. One tracked item is available and neither checkout has started.`;

  const selectScenario = (nextScenarioId: InventoryScenarioId) => {
    setScenarioId(nextScenarioId);
    setStep(0);
  };

  return (
    <div className="docs-simulator rounded-panel border border-border bg-surface shadow-subtle">
      <div className="border-b border-border p-5 sm:p-7">
        <p className="docs-eyebrow">Interactive teaching model</p>
        <h3 className="mt-3 font-display text-2xl font-normal">
          Two customers, one tracked item
        </h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted">
          Deterministic simulation of the documented design; not a live database
          test. Every result comes from the fixed event sequence shown below. No
          API, payment provider, random timing, or real lock is involved.
        </p>
      </div>

      <div className="docs-simulation-interactive p-5 sm:p-7">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label htmlFor="inventory-scenario" className="text-sm font-semibold">
              Scenario
            </label>
            <p id="inventory-scenario-help" className="mt-1 text-xs leading-5 text-ink-muted">
              Changing the scenario resets its replay to step zero.
            </p>
            <select
              id="inventory-scenario"
              value={scenarioId}
              aria-describedby="inventory-scenario-help"
              onChange={(event) =>
                selectScenario(event.target.value as InventoryScenarioId)
              }
              className="mt-3 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {inventoryScenarioIds.map((id) => (
                <option key={id} value={id}>
                  {inventoryScenarios[id].title}
                </option>
              ))}
            </select>
          </div>

          <p className="rounded-pill bg-surface-muted px-4 py-2 text-center text-sm font-semibold">
            Step {step} / {scenario.events.length}
          </p>
        </div>

        <div
          className="docs-simulation-controls mt-5 flex flex-wrap gap-3"
          role="group"
          aria-label="Simulation replay controls"
        >
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
            aria-controls="inventory-simulation-state inventory-simulation-log"
            className="docs-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={17} aria-hidden="true" />
            Previous step
          </button>
          <button
            type="button"
            onClick={() =>
              setStep((current) => Math.min(scenario.events.length, current + 1))
            }
            disabled={step === scenario.events.length}
            aria-controls="inventory-simulation-state inventory-simulation-log"
            className="docs-button disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next step
            <ChevronRight size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setStep(0)}
            disabled={step === 0}
            aria-controls="inventory-simulation-state inventory-simulation-log"
            className="docs-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Reset
          </button>
        </div>

        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-5 rounded-control border-l-4 border-brand bg-brand-soft px-4 py-3 text-sm leading-6"
        >
          {statusText}
        </p>

        <div id="inventory-simulation-state" className="mt-7 space-y-6">
          <div>
            <h4 className="text-sm font-semibold">Tracked inventory state</h4>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ["On hand", state.inventory.onHandQuantity],
                ["Active reserved", state.inventory.reservedQuantity],
                ["Displayed available", state.inventory.availableQuantity],
              ].map(([label, value]) => (
                <div key={label} className="rounded-card bg-surface-muted p-4">
                  <dt className="text-xs font-medium text-ink-muted">{label}</dt>
                  <dd className="mt-2 font-mono text-3xl">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {inventoryCustomerIds.map((customerId) => {
              const customer = state.customers[customerId];
              const reservation = state.reservations[customerId];
              return (
                <section
                  key={customerId}
                  aria-labelledby={`${customerId}-simulation-heading`}
                  className="rounded-card border border-border p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h4 id={`${customerId}-simulation-heading`} className="font-semibold">
                      {customer.label}
                    </h4>
                    <span className="rounded-pill bg-surface-muted px-3 py-1 text-xs font-medium">
                      Attempt {customer.attempts || "not started"}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm leading-6">
                    <dt className="text-ink-muted">Checkout</dt>
                    <dd className="font-medium">{checkoutStatusLabels[customer.checkoutStatus]}</dd>
                    <dt className="text-ink-muted">Reservation</dt>
                    <dd className="font-medium">
                      {reservationStatusLabels[reservation.status]}
                      {reservation.quantity > 0 ? ` · quantity ${reservation.quantity}` : ""}
                      {reservation.deadlinePassed ? " · deadline passed" : ""}
                    </dd>
                    <dt className="text-ink-muted">Payment</dt>
                    <dd className="font-medium">{paymentOutcomeLabels[state.payments[customerId]]}</dd>
                  </dl>
                </section>
              );
            })}
          </div>

          <div className="rounded-card border border-border p-5">
            <h4 className="text-sm font-semibold">Modeled stock-row lock</h4>
            <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">Owner</dt>
                <dd className="mt-1 font-medium">
                  {state.lock.owner ? customerShortLabel(state.lock.owner) : "Unlocked"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Waiting</dt>
                <dd className="mt-1 font-medium">
                  {state.lock.waiting.length > 0
                    ? state.lock.waiting.map(customerShortLabel).join(", ")
                    : "Nobody"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-ink-muted">
              The lock ends with its transaction. A committed reservation remains
              visible after the owner becomes “Unlocked.”
            </p>
          </div>

          <div id="inventory-simulation-log">
            <h4 className="text-sm font-semibold">Completed events</h4>
            {state.history.length === 0 ? (
              <p className="mt-3 rounded-card bg-surface-muted p-4 text-sm text-ink-muted">
                No events yet. Use “Next step” to begin the fixed sequence.
              </p>
            ) : (
              <ol className="mt-3 space-y-3">
                {state.history.map((entry) => (
                  <li key={entry.step} className="grid gap-2 rounded-card border border-border p-4 sm:grid-cols-[3rem_1fr]">
                    <span className="font-mono text-xs text-ink-muted">{entry.step}</span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        {eventLabel(entry.event.type)}
                      </p>
                      <p className="mt-1 text-sm leading-6">{entry.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      <details open className="docs-simulation-transcript border-t border-border p-5 sm:p-7">
        <summary className="cursor-pointer text-sm font-semibold">
          Static transcript: {scenario.title}
        </summary>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          {scenario.summary} {scenario.outcome}
        </p>
        <ol className="mt-5 space-y-4">
          {completedScenario.history.map((entry) => (
            <li key={entry.step} className="break-inside-avoid border-l-2 border-border pl-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Step {entry.step}: {eventLabel(entry.event.type)}
              </p>
              <p className="mt-1 text-sm leading-6">{entry.description}</p>
              <p className="mt-1 font-mono text-xs leading-5 text-ink-muted">
                On hand {entry.onHandQuantity} · reserved {entry.reservedQuantity} ·
                available {entry.availableQuantity} · lock {entry.lockOwner
                  ? customerShortLabel(entry.lockOwner)
                  : "unlocked"} · waiting {entry.waiting.length > 0
                  ? entry.waiting.map(customerShortLabel).join(", ")
                  : "nobody"}
              </p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
