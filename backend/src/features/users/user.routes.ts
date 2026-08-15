import jwt from "jsonwebtoken";
import userService from "./user.service";
import { Router } from "express";
import { asyncHandler } from "../../utils/error";
import {
  createAddressSchema,
  env,
  loginSchema,
  registerSchema,
} from "../../utils/zodSchema";
import bcrypt from "bcrypt";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { Auth } from "../../utils/types";

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

    const { password, ...userWithoutPassword } = user;

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET
    );

    res.status(201).json({
      data: { user: userWithoutPassword, token },
    });
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

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET
    );
    const { password: userPassword, ...userWithoutPassword } = user;
    res.json({
      data: { user: userWithoutPassword, token },
    });
  })
);

userRoutes.get(
  "/address",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;

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

    const userId = req.user!.id;

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
    const userId = req.user!.id;

    const user = await userService.getUserById(userId);

    res.json({
      data: user,
    });
  })
);
