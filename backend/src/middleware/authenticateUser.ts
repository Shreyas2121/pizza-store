import { AppError, asyncHandler } from "../utils/error";
import authenticationService from "../features/auth/auth.service";
import type { AuthenticatedRequest } from "../utils/types";

export const authenticateUser = asyncHandler(async (req: AuthenticatedRequest, res, next) => {
  const authorization = req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access denied, no token provided.",
      code: "AUTH_TOKEN_MISSING",
    });
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({
      message: "Access denied, no token provided.",
      code: "AUTH_TOKEN_MISSING",
    });
  }

  req.principal = await authenticationService.authenticateToken(token);
  next();
});

export const authenticateAdmin = [
  authenticateUser,
  asyncHandler((req: AuthenticatedRequest, _res, next) => {
    if (req.principal?.platformRole !== "admin") {
      throw new AppError("Permission denied.", 403, "PERMISSION_DENIED");
    }
    next();
  }),
];
