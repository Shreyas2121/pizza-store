import { logger } from "./logger";

export interface MaintenanceTask {
  name: string;
  intervalMs: number;
  run: () => Promise<unknown>;
}

// Serialize each task independently. Timers never wake a sleeping Render service.
export function startMaintenance(tasks: MaintenanceTask[]) {
  const stops: Array<() => void> = [];
  const active = new Set<Promise<void>>();
  for (const task of tasks) {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const result = await task.run();
        logger.info(`Maintenance: ${task.name}`, { result });
      } catch (error) {
        logger.error(`Maintenance failed: ${task.name}`, { errorType: error instanceof Error ? error.constructor.name : "Unknown" });
      } finally {
        running = false;
      }
    };
    const run = () => {
      const promise = tick();
      active.add(promise);
      void promise.finally(() => active.delete(promise));
    };
    const timer = setInterval(run, task.intervalMs);
    timer.unref();
    run();
    stops.push(() => clearInterval(timer));
  }
  return async () => {
    stops.forEach(stop => stop());
    await Promise.allSettled([...active]);
  };
}
