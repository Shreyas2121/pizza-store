import { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

import { ZodError } from "zod";
import { Fn } from "./types";

export class AppError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (err: unknown, req: Request, res: Response) => {
  console.error(err); // Log the error for debugging

  // Check if the error is an instance of AppError
  if (err instanceof AppError) {
    logger.error(
      `${err.status} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
    );
    return res.status(err.status).json({ message: err.message });
  }

  logger.error(
    `500 - Internal Server - ${req.originalUrl} - ${req.method} - ${req.ip}`
  );

  // For other errors, return a generic error response
  res.status(500).json({ message: "Internal Server Error" });
};

export const asyncHandler = (fn: Fn) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      handleError(err, req, res);
    });
  };
};

export const handleValidationError = (error: ZodError, res: Response) => {
  const errorMessages = error.errors.map((error) => ({
    field: error.path[0],
    message: error.message,
  }));
  res.status(400).json({ errors: errorMessages });
};
