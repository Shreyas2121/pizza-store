import { AppError } from "../../utils/error";
import type { InvitationRateLimiter } from "./staff.types";

interface RateWindow {
  count: number;
  resetsAt: number;
}

export class InMemoryInvitationRateLimiter implements InvitationRateLimiter {
  private readonly windows = new Map<string, RateWindow>();

  constructor(
    private readonly maximumAttempts = 5,
    private readonly windowMilliseconds = 15 * 60 * 1000
  ) {}

  consume(key: string, now: Date): void {
    const currentTime = now.getTime();
    const current = this.windows.get(key);
    if (!current || current.resetsAt <= currentTime) {
      this.windows.set(key, {
        count: 1,
        resetsAt: currentTime + this.windowMilliseconds,
      });
      this.removeExpiredWindows(currentTime);
      return;
    }
    if (current.count >= this.maximumAttempts) {
      throw new AppError(
        "Too many invitation attempts. Try again later.",
        429,
        "INVITATION_RATE_LIMITED"
      );
    }
    current.count += 1;
  }

  private removeExpiredWindows(currentTime: number) {
    if (this.windows.size < 1_000) return;
    for (const [key, value] of this.windows) {
      if (value.resetsAt <= currentTime) this.windows.delete(key);
    }
  }
}

export const invitationRateLimiter = new InMemoryInvitationRateLimiter();
