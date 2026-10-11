import { Writable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupPromotionImages, deletePrivateReceipt, promotionPublicId, readPrivateReceipt, redirectPromotionImage, uploadPrivateReceipt, uploadPromotionImage, uploadPublicImage } from "./cloudinary-storage";
import type { Request, Response } from "express";

vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    url: vi.fn().mockReturnValue("https://res.cloudinary.com/test-account/image/upload/pizzastore/promotions/remote.webp"),
    uploader: { upload_stream: vi.fn(), destroy: vi.fn().mockResolvedValue({ result: "ok" }) },
    api: { resources: vi.fn() },
    utils: { private_download_url: vi.fn().mockReturnValue("https://api.cloudinary.com/private-signed-download") },
  },
}));

const id = "713ab55b-f7e4-4b4a-abc0-a606671a1a2f";
const image = `https://res.cloudinary.com/test-account/image/upload/v123/pizzastore/promotions/${id}.webp`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "test-account");
  vi.mocked(cloudinary.uploader.upload_stream).mockImplementation((_options, callback) => new Writable({
    write(_chunk, _encoding, done) { done(); },
    final(done) { callback?.(undefined, { secure_url: image } as never); done(); },
  }) as never);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Cloudinary storage", () => {
  it("uploads catalogue images in a separate namespace from stay-mate", async () => {
    expect(await uploadPublicImage(Buffer.from("image"), "catalog")).toBe(image);
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({
      resource_type: "image", type: "upload", overwrite: false, public_id: expect.stringMatching(/^pizzastore\/catalog\//),
    }), expect.any(Function));
  });

  it("keeps remote promotion uploads compatible with the existing relative URL constraint", async () => {
    const url = await uploadPromotionImage(Buffer.from("image"), ".webp");
    expect(url).toMatch(/^\/uploads\/promotions\/[0-9a-f-]{36}\.webp$/);
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({ format: "webp", public_id: promotionPublicId(url) }), expect.any(Function));
    vi.stubEnv("IMAGE_STORAGE", "cloudinary");
    const redirect = vi.fn();
    const set = vi.fn().mockReturnValue({ redirect });
    const next = vi.fn();
    redirectPromotionImage({ params: { key: url.split("/").pop() } } as unknown as Request, { set } as unknown as Response, next);
    expect(redirect).toHaveBeenCalledWith(302, expect.stringContaining("https://res.cloudinary.com/"));
    expect(next).not.toHaveBeenCalled();
    redirectPromotionImage({ params: { key: "../stay-mate.jpg" } } as unknown as Request, { set } as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("only accepts managed promotion URLs from this account for deletion", () => {
    expect(promotionPublicId(image)).toBe(`pizzastore/promotions/${id}`);
    for (const url of [image.replace("test-account", "another-account"), image.replace("promotions", "catalog"), image.replace("pizzastore", "stay-mate"), image.replace("res.cloudinary.com", "example.com"), `${image}?extra=1`]) {
      expect(() => promotionPublicId(url)).toThrow();
    }
  });

  it("cleans only old unreferenced promotion assets across all pages", async () => {
    const orphan = image.replace(id, "ff77d468-6adc-4878-b312-15fe4a7d4639");
    vi.mocked(cloudinary.api.resources).mockResolvedValueOnce({ resources: [{ secure_url: image, created_at: "2026-01-01" }], next_cursor: "page2" });
    vi.mocked(cloudinary.api.resources).mockResolvedValueOnce({ resources: [{ secure_url: orphan, created_at: "2026-01-01" }] });
    expect(await cleanupPromotionImages(new Set([`/uploads/promotions/${id}.webp`]), new Date("2026-02-01"))).toEqual([orphan]);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);
    expect(cloudinary.api.resources).toHaveBeenLastCalledWith(expect.objectContaining({ prefix: "pizzastore/promotions/", next_cursor: "page2" }));
  });

  it("stores receipts as authenticated raw files with schema-compatible keys", async () => {
    const key = await uploadPrivateReceipt(Buffer.from("%PDF-1.7"), ".pdf");
    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({
      resource_type: "raw", type: "authenticated", public_id: `pizzastore/expense-receipts/${key}`,
    }), expect.any(Function));
    await deletePrivateReceipt(key);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(`pizzastore/expense-receipts/${key}`, { resource_type: "raw", type: "authenticated" });
  });

  it("downloads private receipt bytes on the server using an expiring signed API URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("private receipt"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await readPrivateReceipt(`${id}.pdf`)).toEqual(Buffer.from("private receipt"));
    expect(cloudinary.utils.private_download_url).toHaveBeenCalledWith(`pizzastore/expense-receipts/${id}.pdf`, "pdf", expect.objectContaining({ resource_type: "raw", type: "authenticated", expires_at: expect.any(Number) }));
    expect(fetchMock).toHaveBeenCalledWith("https://api.cloudinary.com/private-signed-download", expect.any(Object));
    await expect(readPrivateReceipt("../secret.pdf")).rejects.toMatchObject({ code: "INVALID_RECEIPT_STORAGE_KEY" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
