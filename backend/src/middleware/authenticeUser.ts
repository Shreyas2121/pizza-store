import { AppError, asyncHandler } from "../utils/error";
import jwt from "jsonwebtoken";
import { env } from "../utils/zodSchema";
import { Auth, User } from "../utils/types";

export const authenticateAdmin = asyncHandler((req: Auth, res, next) => {
  let exists = req.header("Authorization")?.startsWith("Bearer ");

  if (!exists)
    res.status(401).json({ message: "Access denied, no token provided." });

  const token = req.header("Authorization")?.replace("Bearer ", "") as string;

  const decoded = jwt.verify(token, env.JWT_SECRET) as User;
  if (decoded.role !== "admin") {
    throw new AppError("Unauthorized", 403);
  }

  req.user = decoded;
  next();
});

export const authenticateUser = asyncHandler((req: Auth, res, next) => {
  let exists = req.header("Authorization")?.startsWith("Bearer ");

  if (!exists)
    res.status(401).json({ message: "Access denied, no token provided." });

  const token = req.header("Authorization")?.replace("Bearer ", "") as string;

  const decoded = jwt.verify(token, env.JWT_SECRET) as User;

  req.user = decoded;
  next();
});
