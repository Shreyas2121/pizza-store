import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type RequestContext = { requestId: string };

const requestContext = new AsyncLocalStorage<RequestContext>();
const SAFE_REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const supplied = req.get("X-Request-ID")?.trim();
  const requestId = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
  res.setHeader("X-Request-ID", requestId);
  requestContext.run({ requestId }, next);
};

export const currentRequestId = () => requestContext.getStore()?.requestId ?? null;

export const withRequestContext = <T>(requestId: string, work: () => T): T =>
  requestContext.run({ requestId }, work);
