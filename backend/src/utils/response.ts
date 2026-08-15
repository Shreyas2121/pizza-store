import { Response } from "express";

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  meta?: any;
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  payload: ApiResponse<T>
) => {
  return res.status(statusCode).json(payload);
};
