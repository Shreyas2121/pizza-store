import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../utils/zodSchema";
import { AppError } from "../../utils/error";

export interface ProtectedValue {
  encrypted: string;
  last4: string;
}

export interface SensitiveDataProtector {
  protect(value: string): ProtectedValue;
}

const configurationError = () => new AppError(
  "Payroll encryption is not configured.", 503, "PAYROLL_ENCRYPTION_NOT_CONFIGURED"
);

export class PayrollSensitiveDataProtector implements SensitiveDataProtector {
  constructor(private readonly secret: string | null | undefined = env.PAYROLL_ENCRYPTION_KEY) {}

  protect(value: string): ProtectedValue {
    if (!this.secret) throw configurationError();
    const normalized = value.trim().toUpperCase();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      encrypted: `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`,
      last4: normalized.slice(-4),
    };
  }

  decrypt(encrypted: string): string {
    if (!this.secret) throw configurationError();
    const [version, iv, tag, ciphertext] = encrypted.split(":");
    if (version !== "v1" || !iv || !tag || !ciphertext) {
      throw new AppError("Encrypted payroll data is invalid.", 500, "PAYROLL_ENCRYPTED_DATA_INVALID");
    }
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new AppError("Encrypted payroll data could not be authenticated.", 500, "PAYROLL_ENCRYPTED_DATA_INVALID");
    }
  }

  private key() {
    return createHash("sha256").update("pizzastore/payroll/v1\0").update(this.secret!).digest();
  }
}

export const maskSensitiveLast4 = (last4: string | null) => last4 ? `••••${last4}` : null;

export default new PayrollSensitiveDataProtector();
