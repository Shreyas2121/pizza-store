import { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

import { ZodError } from "zod";
import { Fn } from "./types";
import { auditRequestFailure } from "./request-failure-audit";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 500,
    public code?: string,
    public data?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (err: unknown, req: Request, res: Response) => {
  if (err instanceof ZodError) {
    logger.error("Request validation failed", {
      method: req.method,
      path: req.path,
      issueCount: err.issues.length,
    });
    return handleValidationError(err, res);
  }

  // Check if the error is an instance of AppError
  if (err instanceof AppError) {
    logger.error("Request failed", {
      status: err.status,
      code: err.code ?? "APP_ERROR",
      method: req.method,
      path: req.path,
    });
    return res.status(err.status).json({
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.data ? { data: err.data } : {}),
    });
  }

  logger.error("Unhandled request failure", {
    status: 500,
    method: req.method,
    path: req.path,
    errorType: err instanceof Error ? err.constructor.name : typeof err,
  });

  // For other errors, return a generic error response
  res.status(500).json({ message: "Internal Server Error" });
};

export const handleErrorWithAudit = async (err: unknown, req: Request, res: Response) => {
  try {
    await auditRequestFailure(req, err);
  } catch (auditError) {
    logger.error("Required high-risk audit persistence failed", {
      method: req.method,
      path: req.path,
      errorType: auditError instanceof Error ? auditError.constructor.name : typeof auditError,
    });
    return handleError(new AppError("Internal Server Error", 500, "AUDIT_PERSISTENCE_FAILED"), req, res);
  }
  return handleError(err, req, res);
};

export const asyncHandler = (fn: Fn) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      void handleErrorWithAudit(err, req, res);
    });
  };
};

export const handleValidationError = (error: ZodError, res: Response) => {
  const errorMessages = error.issues.map((error) => ({
    field: error.path[0],
    message: error.message,
  }));
  res.status(400).json({ errors: errorMessages });
};
