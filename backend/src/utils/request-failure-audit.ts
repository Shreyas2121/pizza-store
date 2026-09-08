import type { Request } from "express";

type FailureAuditor = (error: unknown) => Promise<void>;

const failureAuditors = new WeakMap<Request, FailureAuditor>();

export const setRequestFailureAuditor = (req: Request, auditor: FailureAuditor) => {
  failureAuditors.set(req, auditor);
};

export const auditRequestFailure = async (req: Request, error: unknown) => {
  await failureAuditors.get(req)?.(error);
};
