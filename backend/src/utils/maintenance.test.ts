import { afterEach, expect, it, vi } from "vitest";
import { startMaintenance } from "./maintenance";

vi.mock("./logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
afterEach(() => vi.useRealTimers());

it("runs immediately, prevents overlapping runs, drains work and stops timers", async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const run = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const stop = startMaintenance([{ name: "posting", intervalMs: 1000, run }]);
  expect(run).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(3000);
  expect(run).toHaveBeenCalledTimes(1);
  finish();
  await vi.advanceTimersByTimeAsync(1000);
  expect(run).toHaveBeenCalledTimes(2);
  const stopped = stop();
  finish();
  await stopped;
  await vi.advanceTimersByTimeAsync(5000);
  expect(run).toHaveBeenCalledTimes(2);
});

it("retries after failures and allows independent tasks to continue", async () => {
  vi.useFakeTimers();
  const failing = vi.fn().mockRejectedValue(new Error("database unavailable"));
  const healthy = vi.fn().mockResolvedValue({ processed: 1 });
  const stop = startMaintenance([
    { name: "failed", intervalMs: 1000, run: failing },
    { name: "healthy", intervalMs: 1000, run: healthy },
  ]);
  await vi.advanceTimersByTimeAsync(2000);
  expect(failing).toHaveBeenCalledTimes(3);
  expect(healthy).toHaveBeenCalledTimes(3);
  await stop();
});
