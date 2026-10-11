import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import { AppError } from "./error";
import type { RequestHandler } from "express";

export const usesCloudinary = () => process.env.IMAGE_STORAGE === "cloudinary";

function client() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

async function upload(buffer: Buffer, options: UploadApiOptions) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client().uploader.upload_stream({ timeout: 30_000, overwrite: false, ...options }, (error, result) => {
      if (error || !result) reject(new AppError("File storage is unavailable", 503, "FILE_STORAGE_UNAVAILABLE"));
      else resolve(result);
    });
    stream.on("error", reject);
    Readable.from(buffer).pipe(stream);
  });
}

export async function uploadPublicImage(buffer: Buffer, folder: "catalog" | "promotions") {
  const result = await upload(buffer, { resource_type: "image", type: "upload", public_id: `pizzastore/${folder}/${randomUUID()}` });
  return result.secure_url;
}

const promotionKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const promotionPrefix = "/uploads/promotions/";

export async function uploadPromotionImage(buffer: Buffer, extension: string) {
  const key = `${randomUUID()}${extension}`;
  if (!promotionKeyPattern.test(key)) throw new AppError("Invalid promotion image", 400, "PROMOTION_MEDIA_INVALID");
  await upload(buffer, { resource_type: "image", type: "upload", public_id: `pizzastore/promotions/${key.replace(/\.[^.]+$/, "")}`, format: extension.slice(1) });
  // Preserve the schema's existing relative URL contract; the host redirects to the CDN.
  return `${promotionPrefix}${key}`;
}

export const redirectPromotionImage: RequestHandler = (req, res, next) => {
  const key = req.params.key;
  if (!usesCloudinary() || typeof key !== "string" || !promotionKeyPattern.test(key)) return next();
  const url = client().url(`pizzastore/promotions/${key}`, { resource_type: "image", type: "upload", secure: true });
  res.set("Cache-Control", "public, max-age=60").redirect(302, url);
};

export function promotionPublicId(url: string) {
  if (url.startsWith(promotionPrefix)) {
    const key = url.slice(promotionPrefix.length);
    if (!promotionKeyPattern.test(key)) throw new AppError("Invalid promotion image", 400, "PROMOTION_MEDIA_INVALID");
    return `pizzastore/promotions/${key.replace(/\.[^.]+$/, "")}`;
  }
  const parsed = new URL(url);
  const account = process.env.CLOUDINARY_CLOUD_NAME;
  const prefix = `/${account}/image/upload/`;
  if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com" || parsed.search || parsed.hash || !parsed.pathname.startsWith(prefix)) {
    throw new AppError("Invalid promotion image", 400, "PROMOTION_MEDIA_INVALID");
  }
  const id = parsed.pathname.slice(prefix.length).replace(/^v\d+\//, "").replace(/\.(jpg|jpeg|png|webp)$/, "");
  if (!/^pizzastore\/promotions\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    throw new AppError("Invalid promotion image", 400, "PROMOTION_MEDIA_INVALID");
  }
  return id;
}

export async function removePromotionImage(url: string) {
  await client().uploader.destroy(promotionPublicId(url), { resource_type: "image", type: "upload", invalidate: true });
}

export async function cleanupPromotionImages(references: ReadonlySet<string>, before: Date) {
  const referencedIds = new Set([...references].map(url => promotionPublicId(url)));
  const removed: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await client().api.resources({ resource_type: "image", type: "upload", prefix: "pizzastore/promotions/", max_results: 100, next_cursor: cursor });
    for (const asset of page.resources as Array<{ secure_url: string; created_at: string }>) {
      if (referencedIds.has(promotionPublicId(asset.secure_url)) || new Date(asset.created_at) >= before) continue;
      await removePromotionImage(asset.secure_url);
      removed.push(asset.secure_url);
    }
    cursor = page.next_cursor;
  } while (cursor);
  return removed;
}

function receiptId(key: string) {
  if (!/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(key)) {
    throw new AppError("Receipt storage key is invalid", 500, "INVALID_RECEIPT_STORAGE_KEY");
  }
  return `pizzastore/expense-receipts/${key}`;
}

export async function uploadPrivateReceipt(buffer: Buffer, extension: string) {
  const key = `${randomUUID()}${extension}`;
  await upload(buffer, { resource_type: "raw", type: "authenticated", public_id: receiptId(key) });
  return key;
}

export async function readPrivateReceipt(key: string) {
  const id = receiptId(key);
  const url = client().utils.private_download_url(id, id.split(".").pop()!, {
    resource_type: "raw", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 60,
  });
  // The signed URL stays on the server; authorization is checked by the expense service.
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (response.status === 404) throw new AppError("Receipt file is unavailable", 404, "RECEIPT_FILE_NOT_FOUND");
  if (!response.ok) throw new AppError("Receipt storage is unavailable", 503, "FILE_STORAGE_UNAVAILABLE");
  return Buffer.from(await response.arrayBuffer());
}

export async function deletePrivateReceipt(key: string) {
  await client().uploader.destroy(receiptId(key), { resource_type: "raw", type: "authenticated" });
}
