import { z } from "zod";
import { AppError } from "../../utils/error";
import { PROMOTION_ERROR_CODES } from "./promotion.constants";

export const parsePromotionRequest = <T extends z.ZodType>(
  schema: T,
  input: unknown,
  code: string = PROMOTION_ERROR_CODES.INVALID_DEFINITION,
): z.output<T> => {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError("Invalid promotion request", 400, code);
  return result.data;
};
