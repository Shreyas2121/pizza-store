import type { Request } from "express";
import authorizationService, {
  authenticationRequired,
} from "./access.service";
import type { Permission } from "./access.permissions";
import { asyncHandler } from "../../utils/error";
import { parseStoreId } from "./access.schemas";

export type StoreIdResolver = (req: Request) => number;

export const fromParam = (name: string): StoreIdResolver => (req) =>
  parseStoreId(req.params[name]);

export const requireStorePermission = (
  permission: Permission,
  resolveStoreId: StoreIdResolver
) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.principal) throw authenticationRequired();
    req.authorization = await authorizationService.requireStorePermission({
      principal: req.principal,
      storeId: resolveStoreId(req),
      permission,
    });
    next();
  });
