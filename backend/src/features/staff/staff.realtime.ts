import type { StaffAccessNotifier } from "./staff.types";

export class NoopStaffAccessNotifier implements StaffAccessNotifier {
  async membershipChanged(): Promise<void> {}
}

export const staffAccessNotifier = new NoopStaffAccessNotifier();
