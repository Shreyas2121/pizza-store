import { describe, expect, it } from "vitest";
import { STORE_ROLES } from "../../utils/types";
import {
  assignStaffSchema,
  createInvitationSchema,
  staffRoleSchema,
  updateStaffSchema,
} from "./staff.schemas";

describe("staff role validation", () => {
  it.each(STORE_ROLES)("accepts supported role %s across staff inputs", (role) => {
    expect(staffRoleSchema.parse(role)).toBe(role);
    expect(assignStaffSchema.parse({ email: "STAFF@example.com", role })).toEqual({
      email: "staff@example.com",
      role,
    });
    expect(createInvitationSchema.parse({ email: "staff@example.com", role }).role).toBe(role);
    expect(updateStaffSchema.parse({ role }).role).toBe(role);
  });

  it("rejects unknown roles", () => {
    expect(staffRoleSchema.safeParse("accountant").success).toBe(false);
  });
});
