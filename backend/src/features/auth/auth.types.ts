export type PlatformRole = "admin" | "user";

export interface AccessTokenClaims {
  sub: string;
  jti: string;
  tokenVersion: number;
  iss: string;
  aud: string | string[];
  iat: number;
  exp: number;
}

export interface AuthPrincipal {
  userId: number;
  email: string;
  platformRole: PlatformRole;
  tokenVersion: number;
}

export interface SafeUserDto {
  id: number;
  fname: string;
  lname: string;
  email: string;
  role: PlatformRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const toSafeUserDto = (user: SafeUserDto): SafeUserDto => ({
  id: user.id,
  fname: user.fname,
  lname: user.lname,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
