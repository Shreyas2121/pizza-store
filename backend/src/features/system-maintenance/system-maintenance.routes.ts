import { Router } from "express";
import { authenticateAdmin } from "../../middleware/authenticateUser";
import { asyncHandler } from "../../utils/error";
import type { Auth } from "../../utils/types";
import { clearAllDataSchema } from "./system-maintenance.schemas";
import systemMaintenanceService from "./system-maintenance.service";

export const systemMaintenanceRoutes = Router();

systemMaintenanceRoutes.use(authenticateAdmin);

systemMaintenanceRoutes.post(
  "/clear-all",
  asyncHandler(async (req: Auth, res) => {
    clearAllDataSchema.parse(req.body);
    const data = await systemMaintenanceService.clearAllExceptAdmins(
      req.user!.id
    );

    res.json({ data, message: "All non-admin application data was cleared" });
  })
);
