import { z } from "zod";
import { STORE_ROLES } from "../../utils/types";

export const staffRoleSchema = z.enum(STORE_ROLES);

const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Invalid email format"));

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const staffListQuerySchema = paginationSchema.extend({
  status: z.enum(["active", "suspended", "revoked"]).optional(),
});

export const invitationListQuerySchema = paginationSchema;

export const assignStaffSchema = z
  .object({ email: normalizedEmailSchema, role: staffRoleSchema })
  .strict();

export const updateStaffSchema = z
  .object({
    role: staffRoleSchema.optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .strict()
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "Role or status is required",
  });

export const createInvitationSchema = z
  .object({ email: normalizedEmailSchema, role: staffRoleSchema })
  .strict();

export const acceptInvitationSchema = z
  .object({ token: z.string().min(43).max(512) })
  .strict();

export const positiveIdSchema = z.coerce.number().int().positive();
