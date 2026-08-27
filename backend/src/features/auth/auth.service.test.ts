import jwt, { type SignOptions } from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { AuthenticationService, type AuthenticationConfig } from "./auth.service";
import { toSafeUserDto } from "./auth.types";
import { loginSchema, registerSchema } from "../../utils/zodSchema";
import { normalizeEmail } from "../users/user.service";
import type { User } from "../../utils/types";

const config: AuthenticationConfig = {
  secret: "unit-test-secret-that-is-not-used-outside-tests",
  algorithm: "HS256",
  issuer: "pizzastore-api",
  audience: "pizzastore-web",
  expiresIn: "6h",
};

const activeUser = {
  id: 7,
  email: "customer@example.com",
  role: "user" as const,
  tokenVersion: 3,
  isActive: true,
};

const createService = (user: typeof activeUser | null = activeUser) => {
  const getPrincipalUserById = vi.fn().mockResolvedValue(user ?? undefined);
  return {
    service: new AuthenticationService({ getPrincipalUserById }, config),
    getPrincipalUserById,
  };
};

const signToken = (
  overrides: Record<string, unknown> = {},
  options: SignOptions = {}
) =>
  jwt.sign(
    { tokenVersion: activeUser.tokenVersion, ...overrides },
    config.secret,
    {
      algorithm: config.algorithm,
      subject: String(activeUser.id),
      jwtid: "test-token-id",
      issuer: config.issuer,
      audience: config.audience,
      expiresIn: config.expiresIn,
      ...options,
    }
  );

describe("AuthenticationService", () => {
  it("issues a minimal token with identity, revocation, issuer, audience, and expiry claims", () => {
    const { service } = createService();
    const token = service.issueAccessToken(activeUser);
    const claims = jwt.decode(token);

    expect(claims).toMatchObject({
      sub: String(activeUser.id),
      tokenVersion: activeUser.tokenVersion,
      iss: config.issuer,
      aud: config.audience,
    });
    expect(claims).not.toHaveProperty("email");
    expect(claims).not.toHaveProperty("role");
    expect(claims).toHaveProperty("jti");
    expect(claims).toHaveProperty("iat");
    expect(claims).toHaveProperty("exp");
    if (!claims || typeof claims === "string") throw new Error("Expected JWT claims");
    expect(claims.exp! - claims.iat!).toBe(6 * 60 * 60);
  });

  it.each([
    ["algorithm", { algorithm: "HS384" as const }],
    ["issuer", { issuer: "another-api" }],
    ["audience", { audience: "another-client" }],
  ])("rejects a token with an invalid %s", async (_name, options) => {
    const { service, getPrincipalUserById } = createService();
    const token = signToken({}, options);

    await expect(service.authenticateToken(token)).rejects.toMatchObject({
      status: 401,
      code: "AUTH_TOKEN_INVALID",
    });
    expect(getPrincipalUserById).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    const { service } = createService();
    const token = signToken({}, { expiresIn: -1 });

    await expect(service.authenticateToken(token)).rejects.toMatchObject({
      status: 401,
      code: "AUTH_TOKEN_EXPIRED",
    });
  });

  it.each([
    ["missing", null],
    ["inactive", { ...activeUser, isActive: false }],
  ])("rejects a %s principal", async (_name, user) => {
    const { service } = createService(user);

    await expect(service.authenticateToken(signToken())).rejects.toMatchObject({
      status: 401,
      code: "AUTH_PRINCIPAL_INACTIVE",
    });
  });

  it("rejects a token-version mismatch", async () => {
    const { service } = createService({ ...activeUser, tokenVersion: 4 });

    await expect(service.authenticateToken(signToken())).rejects.toMatchObject({
      status: 401,
      code: "AUTH_TOKEN_REVOKED",
    });
  });

  it("uses the current database platform role instead of a token role", async () => {
    const admin = { ...activeUser, role: "admin" as const };
    const { service } = createService(admin);
    const token = signToken({ role: "user" });

    await expect(service.authenticateToken(token)).resolves.toEqual({
      userId: admin.id,
      email: admin.email,
      platformRole: "admin",
      tokenVersion: admin.tokenVersion,
    });
  });

  it("authenticates an active customer token", async () => {
    const { service, getPrincipalUserById } = createService();

    await expect(service.authenticateToken(signToken())).resolves.toMatchObject({
      userId: activeUser.id,
      platformRole: "user",
    });
    expect(getPrincipalUserById).toHaveBeenCalledWith(activeUser.id);
  });
});

describe("authentication DTOs and normalization", () => {
  it("normalizes registration and login emails", () => {
    expect(normalizeEmail("  Mixed.Case@Example.COM ")).toBe("mixed.case@example.com");
    expect(loginSchema.parse({ email: " Mixed@Example.COM ", password: "secret" }).email).toBe(
      "mixed@example.com"
    );
    expect(
      registerSchema.parse({
        fname: "Test",
        lname: "User",
        email: " Mixed@Example.COM ",
        password: "secret",
      }).email
    ).toBe("mixed@example.com");
  });

  it("excludes password and token version from the safe user DTO", () => {
    const databaseUser: User = {
      ...activeUser,
      fname: "Test",
      lname: "User",
      password: "password-hash",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };

    const dto = toSafeUserDto(databaseUser);
    expect(dto).not.toHaveProperty("password");
    expect(dto).not.toHaveProperty("tokenVersion");
    expect(dto).toMatchObject({ id: activeUser.id, email: activeUser.email });
  });
});
