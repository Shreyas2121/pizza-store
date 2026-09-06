import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import userService from "../users/user.service";
import { AppError } from "../../utils/error";
import { env } from "../../utils/zodSchema";
import type { User } from "../../utils/types";
import type { AccessTokenClaims, AuthPrincipal } from "./auth.types";

type PrincipalUser = Pick<User, "id" | "email" | "role" | "tokenVersion" | "isActive">;

export interface PrincipalUserLoader {
  getPrincipalUserById(id: number): Promise<PrincipalUser | undefined>;
}

export interface AuthenticationConfig {
  secret: string;
  algorithm: "HS256";
  issuer: string;
  audience: string;
  expiresIn: SignOptions["expiresIn"];
}

const authenticationConfig: AuthenticationConfig = {
  secret: env.JWT_SECRET,
  algorithm: env.JWT_ALGORITHM,
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
  expiresIn: env.JWT_EXPIRES_IN,
};

export class AuthenticationService {
  constructor(
    private readonly users: PrincipalUserLoader = userService,
    private readonly config: AuthenticationConfig = authenticationConfig
  ) {}

  issueAccessToken(user: Pick<User, "id" | "tokenVersion">): string {
    return jwt.sign(
      { tokenVersion: user.tokenVersion },
      this.config.secret,
      {
        algorithm: this.config.algorithm,
        subject: String(user.id),
        jwtid: randomUUID(),
        issuer: this.config.issuer,
        audience: this.config.audience,
        expiresIn: this.config.expiresIn,
      }
    );
  }

  async authenticateToken(token: string): Promise<AuthPrincipal> {
    const claims = this.verifyAccessToken(token);
    const userId = Number(claims.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new AppError("Invalid access token.", 401, "AUTH_TOKEN_INVALID");
    }

    const user = await this.users.getPrincipalUserById(userId);
    if (!user || !user.isActive) {
      throw new AppError("Account is unavailable.", 401, "AUTH_PRINCIPAL_INACTIVE");
    }
    if (user.tokenVersion !== claims.tokenVersion) {
      throw new AppError("Access token has been revoked.", 401, "AUTH_TOKEN_REVOKED");
    }

    return {
      userId: user.id,
      email: user.email,
      platformRole: user.role,
      tokenVersion: user.tokenVersion,
      authenticatedAt: new Date(claims.iat * 1000),
    };
  }

  private verifyAccessToken(token: string): AccessTokenClaims {
    try {
      const decoded = jwt.verify(token, this.config.secret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience,
      });

      if (!this.isAccessTokenClaims(decoded)) {
        throw new AppError("Invalid access token.", 401, "AUTH_TOKEN_INVALID");
      }
      return decoded;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError("Access token has expired.", 401, "AUTH_TOKEN_EXPIRED");
      }
      throw new AppError("Invalid access token.", 401, "AUTH_TOKEN_INVALID");
    }
  }

  private isAccessTokenClaims(value: string | JwtPayload): value is AccessTokenClaims {
    return (
      typeof value !== "string" &&
      typeof value.sub === "string" &&
      typeof value.jti === "string" &&
      value.jti.length > 0 &&
      Number.isInteger(value.tokenVersion) &&
      value.tokenVersion >= 0 &&
      value.iss === this.config.issuer &&
      (value.aud === this.config.audience ||
        (Array.isArray(value.aud) && value.aud.includes(this.config.audience))) &&
      typeof value.iat === "number" &&
      typeof value.exp === "number"
    );
  }
}

export default new AuthenticationService();
