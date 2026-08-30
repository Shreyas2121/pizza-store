import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { asyncHandler } from "../../utils/error";
import { authenticationRequired } from "../access/access.service";
import {
  acceptInvitationSchema,
  assignStaffSchema,
  createInvitationSchema,
  invitationListQuerySchema,
  positiveIdSchema,
  staffListQuerySchema,
  updateStaffSchema,
} from "./staff.schemas";
import staffService from "./staff.service";

export const staffRoutes = Router();
export const staffInvitationRoutes = Router();

staffRoutes.use(authenticateUser);

staffRoutes.get(
  "/:storeId/staff",
  asyncHandler(async (req, res) => {
    if (!req.principal) throw authenticationRequired();
    const storeId = positiveIdSchema.parse(req.params.storeId);
    const query = staffListQuerySchema.parse(req.query);
    const result = await staffService.listStaff({ principal: req.principal, storeId, ...query });
    res.json({ data: result.items, meta: result.meta });
  })
);

staffRoutes.post(
  "/:storeId/staff",
  asyncHandler(async (req, res) => {
    if (!req.principal) throw authenticationRequired();
    const storeId = positiveIdSchema.parse(req.params.storeId);
    const body = assignStaffSchema.parse(req.body);
    const membership = await staffService.assignStaff({ principal: req.principal, storeId, ...body });
    res.status(201).json({ data: membership, message: "Staff membership assigned." });
  })
);

staffRoutes.patch(
  "/:storeId/staff/:membershipId",
  asyncHandler(async (req, res) => {
    if (!req.principal) throw authenticationRequired();
    const storeId = positiveIdSchema.parse(req.params.storeId);
    const membershipId = positiveIdSchema.parse(req.params.membershipId);
    const body = updateStaffSchema.parse(req.body);
    const membership = await staffService.updateStaff({
      principal: req.principal,
      storeId,
      membershipId,
      ...body,
    });
    res.json({ data: membership, message: "Staff membership updated." });
  })
);

staffRoutes.delete(
  "/:storeId/staff/:membershipId",
  asyncHandler(async (req, res) => {
    if (!req.principal) throw authenticationRequired();
    const storeId = positiveIdSchema.parse(req.params.storeId);
    const membershipId = positiveIdSchema.parse(req.params.membershipId);
    const membership = await staffService.revokeStaff({
      principal: req.principal,
      storeId,
      membershipId,
    });
    res.json({ data: membership, message: "Staff membership revoked." });
  })
);

staffRoutes.get(
  "/:storeId/staff/invitations",
  asyncHandler(async (req, res) => {
    if (!req.principal) throw authenticationRequired();
    const storeId = positiveIdSchema.parse(req.params.storeId);
    const query = invitationListQuerySchema.parse(req.query);
    const result = await staffService.listInvitations({ principal: req.principal, storeId, ...query });
    res.json({ data: result.items, meta: result.meta });
  })
);

staffRoutes.post(
  "/:storeId/staff/invitations",
  asyncHandler(async (req, res) => {
    if (!req.principal) throw authenticationRequired();
    const storeId = positiveIdSchema.parse(req.params.storeId);
    const body = createInvitationSchema.parse(req.body);
    const result = await staffService.createInvitation({ principal: req.principal, storeId, ...body });
    res.status(201).json({ data: result, message: "Staff invitation created." });
  })
);

staffRoutes.delete(
  "/:storeId/staff/invitations/:invitationId",
  asyncHandler(async (req, res) => {
    if (!req.principal) throw authenticationRequired();
    const storeId = positiveIdSchema.parse(req.params.storeId);
    const invitationId = positiveIdSchema.parse(req.params.invitationId);
    const invitation = await staffService.revokeInvitation({
      principal: req.principal,
      storeId,
      invitationId,
    });
    res.json({ data: invitation, message: "Staff invitation revoked." });
  })
);

staffInvitationRoutes.post(
  "/accept",
  authenticateUser,
  asyncHandler(async (req, res) => {
    if (!req.principal) throw authenticationRequired();
    const { token } = acceptInvitationSchema.parse(req.body);
    const membership = await staffService.acceptInvitation({ principal: req.principal, token });
    res.json({ data: membership, message: "Staff invitation accepted." });
  })
);
