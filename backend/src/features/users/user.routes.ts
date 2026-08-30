import userService from "./user.service";
import { Router } from "express";
import { AppError, asyncHandler } from "../../utils/error";
import {
  createAddressSchema,
  loginSchema,
  registerSchema,
} from "../../utils/zodSchema";
import bcrypt from "bcryptjs";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { parseIntegerParam } from "../../utils/request";
import { Auth } from "../../utils/types";
import authenticationService from "../auth/auth.service";
import { toSafeUserDto } from "../auth/auth.types";

export const userRoutes = Router();

userRoutes.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const data = req.body;
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await userService.createUser({
      ...data,
      password: hashedPassword,
    });

    const token = authenticationService.issueAccessToken(user);

    res.status(201).json({
      data: { user: toSafeUserDto(user), token },
    });
  })
);

userRoutes.patch(
  "/address/:addressId",
  authenticateUser,
  validateBody(createAddressSchema),
  asyncHandler(async (req: Auth, res) => {
    const addressId = parseIntegerParam(req.params.addressId, "Address ID");
    const [address] = await userService.updateUserAddress(addressId, req.principal!.userId, req.body);
    if (!address) throw new AppError("Address not found.", 404);
    res.json({ data: { address, message: "Address updated." } });
  })
);

userRoutes.delete(
  "/address/:addressId",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const addressId = parseIntegerParam(req.params.addressId, "Address ID");
    const [deleted] = await userService.deleteUserAddress(addressId, req.principal!.userId);
    if (!deleted) throw new AppError("Address not found.", 404);
    res.json({ data: { id: deleted.id, message: "Address deleted." } });
  })
);

userRoutes.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await userService.getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = authenticationService.issueAccessToken(user);
    res.json({
      data: { user: toSafeUserDto(user), token },
    });
  })
);

userRoutes.get(
  "/address",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const userId = req.principal!.userId;

    const addresses = await userService.getUserAddress(userId);

    res.json({
      data: addresses,
    });
  })
);

userRoutes.post(
  "/address",
  authenticateUser,
  validateBody(createAddressSchema),
  asyncHandler(async (req: Auth, res) => {
    const data = req.body;

    const userId = req.principal!.userId;

    const [address] = await userService.createUserAddress({
      ...data,
      userId,
    });

    res.json({
      data: {
        address,
        message: "Address created.",
      },
    });
  })
);

userRoutes.get(
  "",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const userId = req.principal!.userId;

    const user = await userService.getUserById(userId);

    res.json({
      data: user ? toSafeUserDto(user) : null,
    });
  })
);
