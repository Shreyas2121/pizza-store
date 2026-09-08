import type { Request, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../../utils/error";
import { setRequestFailureAuditor } from "../../utils/request-failure-audit";
import type { Auth } from "../../utils/types";
import auditService from "./audit.service";
import type { AuditResourceType, HighRiskAuditOperation } from "./audit.types";

type AuditValue = number | string | string[] | null | undefined;

export interface HighRiskAuditDescriptor {
  operation: HighRiskAuditOperation;
  resourceType: AuditResourceType;
  resourceId: (req: Request) => AuditValue;
  storeId?: (req: Request) => number | null | undefined;
}

const classifyFailure = (error: unknown): { outcome: "failure" | "denied"; reasonCode: string } => {
  if (error instanceof ZodError) return { outcome: "failure", reasonCode: "REQUEST_VALIDATION_FAILED" };
  if (error instanceof AppError) {
    const denied = error.status === 401 || error.status === 403 || error.code === "RESOURCE_NOT_FOUND";
    return {
      outcome: denied ? "denied" : "failure",
      reasonCode: error.code ?? (denied ? "ACCESS_DENIED" : "OPERATION_FAILED"),
    };
  }
  return { outcome: "failure", reasonCode: "UNHANDLED_OPERATION_FAILURE" };
};

const safeResourceId = (value: AuditValue) => {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate > 0) return candidate;
  if (typeof candidate === "string" && (/^[1-9]\d{0,18}$/.test(candidate) || candidate === "new" || candidate === "stale-refunds")) return candidate;
  return candidate === null || candidate === undefined || candidate === "" ? "unknown" : "invalid";
};
const safeStoreId = (value: number | null | undefined) => Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;

export const auditHighRiskOperation = (descriptor: HighRiskAuditDescriptor): RequestHandler => (req, _res, next) => {
  setRequestFailureAuditor(req, async (error) => {
    const classified = classifyFailure(error);
    await auditService.writeAttempt({
      actor: (req as Auth).principal ?? null,
      storeId: safeStoreId(descriptor.storeId?.(req)),
      operation: descriptor.operation,
      resourceType: descriptor.resourceType,
      resourceId: safeResourceId(descriptor.resourceId(req)),
      ...classified,
    });
  });
  next();
};
