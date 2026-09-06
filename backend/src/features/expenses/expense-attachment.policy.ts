import path from "path";
import { createHash } from "crypto";
import { AppError } from "../../utils/error";

export const MAX_EXPENSE_RECEIPT_BYTES = 5 * 1024 * 1024;
const extensions: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const detectedType = (buffer: Buffer): keyof typeof extensions | null => {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
};

export const validateExpenseReceipt = (file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) => {
  const originalName = file.originalname.normalize("NFKC").trim();
  if (!originalName || originalName.length > 255 || originalName.includes("/") || originalName.includes("\\") || Array.from(originalName).some((item) => (item.codePointAt(0) ?? 0) < 32 || item.codePointAt(0) === 127)) {
    throw new AppError("Receipt filename is invalid.", 422, "INVALID_RECEIPT_FILENAME");
  }
  if (file.size < 1 || file.size > MAX_EXPENSE_RECEIPT_BYTES || file.buffer.length !== file.size) {
    throw new AppError("Receipt must be between 1 byte and 5 MiB.", 413, "INVALID_RECEIPT_SIZE");
  }
  const mediaType = detectedType(file.buffer);
  const extension = path.extname(originalName).toLowerCase();
  if (!mediaType || mediaType !== file.mimetype || !extensions[mediaType].includes(extension)) {
    throw new AppError("Receipt content, media type, and extension must agree (PDF, JPEG, PNG, or WebP).", 422, "INVALID_RECEIPT_TYPE");
  }
  return { originalName, mediaType, extension: mediaType === "image/jpeg" ? ".jpg" : extension, sizeBytes: file.size, sha256: createHash("sha256").update(file.buffer).digest("hex") };
};
