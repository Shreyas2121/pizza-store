import { randomUUID } from "node:crypto";
import { mkdir, lstat, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AppError } from "../../utils/error";
import { logger } from "../../utils/logger";
import {
  PROMOTION_DESKTOP_MIN_HEIGHT,
  PROMOTION_DESKTOP_MIN_WIDTH,
  PROMOTION_ERROR_CODES,
  PROMOTION_IMAGE_MAX_BYTES,
  PROMOTION_IMAGE_MAX_HEIGHT,
  PROMOTION_IMAGE_MAX_WIDTH,
  PROMOTION_MEDIA_DIRECTORY,
  PROMOTION_MEDIA_FORMATS,
  PROMOTION_MEDIA_ORPHAN_MIN_AGE_MS,
  PROMOTION_MEDIA_URL_PREFIX,
  PROMOTION_MOBILE_MIN_HEIGHT,
  PROMOTION_MOBILE_MIN_WIDTH,
} from "./promotion.constants";
import type { PromotionMediaVariant } from "./promotion.types";
import { currentRequestId } from "../../utils/request-context";

export interface PromotionMediaFile {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}
const invalidMedia = () =>
  new AppError(
    "Invalid promotion image",
    400,
    PROMOTION_ERROR_CODES.MEDIA_INVALID,
  );
const storageFailure = () =>
  new AppError(
    "Promotion image storage failed",
    500,
    PROMOTION_ERROR_CODES.MEDIA_STORAGE_FAILED,
  );
const safeKey =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const hasPngAnimation = (buffer: Buffer) => {
  if (
    !buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return false;
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    if (offset + length + 12 > buffer.length) throw invalidMedia();
    if (buffer.toString("ascii", offset + 4, offset + 8) === "acTL")
      return true;
    offset += length + 12;
  }
  return false;
};

export const validatePromotionMedia = async (
  file: PromotionMediaFile | undefined,
  variant: PromotionMediaVariant,
) => {
  if (
    !file ||
    !["desktop", "mobile"].includes(variant) ||
    file.size !== file.buffer.length ||
    file.size === 0 ||
    file.size > PROMOTION_IMAGE_MAX_BYTES
  )
    throw invalidMedia();
  try {
    const image = sharp(file.buffer, {
      failOn: "warning",
      limitInputPixels: PROMOTION_IMAGE_MAX_WIDTH * PROMOTION_IMAGE_MAX_HEIGHT,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== "jpeg" &&
      metadata.format !== "png" &&
      metadata.format !== "webp"
    )
      throw invalidMedia();
    const format = PROMOTION_MEDIA_FORMATS[metadata.format];
    const extensions: readonly string[] = format.extensions;
    if (
      file.mimetype !== format.mime ||
      !extensions.includes(path.extname(file.originalname).toLowerCase()) ||
      (metadata.pages ?? 1) !== 1 ||
      hasPngAnimation(file.buffer)
    )
      throw invalidMedia();
    const width = metadata.width;
    const height = metadata.height;
    const minWidth =
      variant === "desktop"
        ? PROMOTION_DESKTOP_MIN_WIDTH
        : PROMOTION_MOBILE_MIN_WIDTH;
    const minHeight =
      variant === "desktop"
        ? PROMOTION_DESKTOP_MIN_HEIGHT
        : PROMOTION_MOBILE_MIN_HEIGHT;
    if (
      !width ||
      !height ||
      width < minWidth ||
      height < minHeight ||
      width > PROMOTION_IMAGE_MAX_WIDTH ||
      height > PROMOTION_IMAGE_MAX_HEIGHT
    )
      throw invalidMedia();
    // toBuffer forces a full pixel decode. Re-encoding strips requester metadata
    // and trailing content; metadata() alone does not validate pixel data.
    const buffer = await image.toFormat(metadata.format).toBuffer();
    if (buffer.length > PROMOTION_IMAGE_MAX_BYTES) throw invalidMedia();
    return { buffer, extension: format.extension };
  } catch {
    throw invalidMedia();
  }
};

export class PromotionMediaStorage {
  constructor(
    private readonly root = path.resolve(PROMOTION_MEDIA_DIRECTORY),
  ) {}
  private async ensureRoot() {
    await mkdir(this.root, { recursive: true });
    const info = await lstat(this.root);
    if (!info.isDirectory() || info.isSymbolicLink()) throw storageFailure();
  }
  private filePath(key: string) {
    if (!safeKey.test(key)) throw invalidMedia();
    const resolved = path.resolve(this.root, key);
    if (path.dirname(resolved) !== path.resolve(this.root))
      throw invalidMedia();
    return resolved;
  }
  keyFromUrl(url: string) {
    if (!url.startsWith(PROMOTION_MEDIA_URL_PREFIX)) throw invalidMedia();
    const key = url.slice(PROMOTION_MEDIA_URL_PREFIX.length);
    this.filePath(key);
    return key;
  }
  async put(buffer: Buffer, extension: string) {
    const key = `${randomUUID()}${extension}`;
    const filePath = this.filePath(key);
    try {
      await this.ensureRoot();
      await writeFile(filePath, buffer, { flag: "wx" });
    } catch {
      throw storageFailure();
    }
    return `${PROMOTION_MEDIA_URL_PREFIX}${key}`;
  }
  async remove(url: string) {
    const filePath = this.filePath(this.keyFromUrl(url));
    try {
      await this.ensureRoot();
      const info = await lstat(filePath);
      if (!info.isFile() || info.isSymbolicLink()) throw invalidMedia();
      await unlink(filePath);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        return;
      throw error;
    }
  }
  async cleanup(references: ReadonlySet<string>, now: Date) {
    await this.ensureRoot();
    const removed: string[] = [];
    for (const file of await readdir(this.root, { withFileTypes: true })) {
      if (!file.isFile() || !safeKey.test(file.name)) continue;
      const url = `${PROMOTION_MEDIA_URL_PREFIX}${file.name}`;
      if (references.has(url)) continue;
      const info = await lstat(this.filePath(file.name));
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        now.getTime() - info.mtimeMs < PROMOTION_MEDIA_ORPHAN_MIN_AGE_MS
      )
        continue;
      await this.remove(url);
      removed.push(url);
    }
    return removed;
  }
  reportCleanupFailure(url: string) {
    const key = url.startsWith(PROMOTION_MEDIA_URL_PREFIX)
      ? url.slice(PROMOTION_MEDIA_URL_PREFIX.length)
      : "";
    logger.warn("Promotion media retained for orphan cleanup", {
      storageKey: safeKey.test(key) ? key : "unmanaged-reference",
      requestId: currentRequestId(),
    });
  }
}
export default new PromotionMediaStorage();
