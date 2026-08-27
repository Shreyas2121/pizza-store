import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { asyncHandler } from "../../utils/error";
import authorizationService, {
  authenticationRequired,
} from "./access.service";

export const accessRoutes = Router();

accessRoutes.get(
  "/me",
  authenticateUser,
  asyncHandler(async (req, res) => {
    if (!req.principal) throw authenticationRequired();
    const access = await authorizationService.getCurrentAccess(req.principal);
    res.json({ data: access });
  })
);
