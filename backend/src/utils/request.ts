import { AppError } from "./error";

type RouteParam = string | string[] | undefined;

export const requireRouteParam = (
  value: RouteParam,
  label = "Route parameter",
) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError(`${label} is required`, 400);
  }

  return value;
};

export const parseIntegerParam = (value: RouteParam, label = "ID") => {
  const rawValue = requireRouteParam(value, label);
  const parsedValue = Number(rawValue);

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new AppError(`${label} must be a positive integer`, 400);
  }

  return parsedValue;
};
