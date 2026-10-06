import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import {
  PromotionMediaStorage,
  validatePromotionMedia,
} from "./promotion-media.storage";
import {
  PROMOTION_IMAGE_MAX_BYTES,
  PROMOTION_MEDIA_ORPHAN_MIN_AGE_MS,
} from "./promotion.constants";
import type { PromotionMediaVariant } from "./promotion.types";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    // Every root was created by mkdtemp under the system temp directory.
    if (
      path.dirname(root) !== path.resolve(tmpdir()) ||
      !path.basename(root).startsWith("promotion-")
    )
      throw new Error("Unsafe test cleanup target");
    await rm(root, { recursive: true, force: true });
  }
});
const image = async (
  format: "png" | "jpeg" | "webp" = "png",
  width = 1200,
  height = 400,
) => {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: "red" },
  })
    .toFormat(format)
    .toBuffer();
  return {
    buffer,
    size: buffer.length,
    mimetype: "image/" + format,
    originalname: format === "jpeg" ? "banner.jpg" : "banner." + format,
  };
};

describe("promotion image decoding", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "fully decodes and re-encodes valid %s",
    async (format) => {
      const file = await image(format);
      const validated = await validatePromotionMedia(file, "desktop");
      const metadata = await sharp(validated.buffer).metadata();
      expect(metadata.format).toBe(format);
      expect(metadata.width).toBe(1200);
    },
  );
  it("accepts mobile at the minimum dimensions and ignores requester path segments", async () => {
    const file = {
      ...(await image("png", 600, 600)),
      originalname: "../../private/banner.png",
    };
    expect((await validatePromotionMedia(file, "mobile")).extension).toBe(
      ".png",
    );
  });
  it("rejects byte limits, MIME/extension mismatches, malformed images and bad variants", async () => {
    const file = await image();
    for (const invalid of [
      undefined,
      { ...file, size: 0 },
      { ...file, size: PROMOTION_IMAGE_MAX_BYTES + 1 },
      { ...file, mimetype: "image/jpeg" },
      { ...file, originalname: "banner.svg" },
      { ...file, buffer: Buffer.from("junk"), size: 4 },
    ]) {
      await expect(
        validatePromotionMedia(invalid, "desktop"),
      ).rejects.toMatchObject({ code: "PROMOTION_MEDIA_INVALID" });
    }
    await expect(
      validatePromotionMedia(file, "unexpected" as PromotionMediaVariant),
    ).rejects.toMatchObject({ code: "PROMOTION_MEDIA_INVALID" });
  });
  it.each([
    [1199, 400, "desktop"],
    [1200, 399, "desktop"],
    [599, 600, "mobile"],
    [600, 599, "mobile"],
    [4097, 400, "desktop"],
    [1200, 2161, "desktop"],
  ] as const)(
    "rejects %d x %d %s dimensions",
    async (width, height, variant) => {
      await expect(
        validatePromotionMedia(await image("png", width, height), variant),
      ).rejects.toMatchObject({ code: "PROMOTION_MEDIA_INVALID" });
    },
  );
  it("rejects a valid header with truncated pixel data", async () => {
    const file = await image("jpeg");
    const buffer = file.buffer.subarray(0, Math.floor(file.buffer.length / 2));
    await expect(
      validatePromotionMedia(
        { ...file, buffer, size: buffer.length },
        "desktop",
      ),
    ).rejects.toMatchObject({ code: "PROMOTION_MEDIA_INVALID" });
  });
  it("rejects SVG, GIF and animated WebP", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400"><rect width="1200" height="400" fill="red"/></svg>',
    );
    await expect(
      validatePromotionMedia(
        {
          buffer: svg,
          size: svg.length,
          mimetype: "image/svg+xml",
          originalname: "banner.svg",
        },
        "desktop",
      ),
    ).rejects.toMatchObject({ code: "PROMOTION_MEDIA_INVALID" });
    const raw = Buffer.alloc(1200 * 800 * 3, 255);
    raw.fill(0, 1200 * 400 * 3);
    const animated = await sharp(raw, {
      raw: { width: 1200, height: 800, channels: 3, pageHeight: 400 },
    })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    await expect(
      validatePromotionMedia(
        {
          buffer: animated,
          size: animated.length,
          mimetype: "image/webp",
          originalname: "banner.webp",
        },
        "desktop",
      ),
    ).rejects.toMatchObject({ code: "PROMOTION_MEDIA_INVALID" });
    const gif = await sharp(svg).gif().toBuffer();
    await expect(
      validatePromotionMedia(
        {
          buffer: gif,
          size: gif.length,
          mimetype: "image/gif",
          originalname: "banner.gif",
        },
        "desktop",
      ),
    ).rejects.toMatchObject({ code: "PROMOTION_MEDIA_INVALID" });
  });
});

describe("promotion media filesystem safety", () => {
  const storage = async () => {
    const root = await mkdtemp(path.join(tmpdir(), "promotion-media-"));
    roots.push(root);
    return { root, service: new PromotionMediaStorage(root) };
  };
  it("generates unique filenames, returns application URLs, and rejects traversal", async () => {
    const { root, service } = await storage();
    const urls = await Promise.all([
      service.put(Buffer.from("one"), ".png"),
      service.put(Buffer.from("two"), ".png"),
    ]);
    expect(urls[0]).not.toBe(urls[1]);
    expect(urls[0]).toMatch(/^\/uploads\/promotions\/[0-9a-f-]+\.png$/);
    expect(await readdir(root)).toHaveLength(2);
    for (const url of [
      "/uploads/promotions/../../outside.png",
      "C:/private.png",
      "/uploads/promotions/%2e%2e.png",
      "/uploads/promotions/..\\outside.png",
    ]) {
      await expect(service.remove(url)).rejects.toMatchObject({
        code: "PROMOTION_MEDIA_INVALID",
      });
    }
    await expect(
      service.put(Buffer.from("data"), ".png/../../outside"),
    ).rejects.toMatchObject({ code: "PROMOTION_MEDIA_INVALID" });
  });
  it("removes only old unreferenced randomized files and is idempotent", async () => {
    const { root, service } = await storage();
    const referenced = await service.put(Buffer.from("kept"), ".png");
    const orphan = await service.put(Buffer.from("orphan"), ".png");
    const recent = await service.put(Buffer.from("recent"), ".png");
    const now = new Date();
    const old = new Date(
      now.getTime() - PROMOTION_MEDIA_ORPHAN_MIN_AGE_MS - 1000,
    );
    for (const url of [referenced, orphan])
      await utimes(path.join(root, service.keyFromUrl(url)), old, old);
    await writeFile(path.join(root, "user-file.txt"), "untouched");
    expect(await service.cleanup(new Set([referenced]), now)).toEqual([orphan]);
    expect(await service.cleanup(new Set([referenced]), now)).toEqual([]);
    expect(
      await readFile(path.join(root, service.keyFromUrl(referenced)), "utf8"),
    ).toBe("kept");
    expect(
      await readFile(path.join(root, service.keyFromUrl(recent)), "utf8"),
    ).toBe("recent");
  });
  it("does not follow directory junctions out of the media root", async () => {
    const { root, service } = await storage();
    const outside = await mkdtemp(path.join(tmpdir(), "promotion-outside-"));
    roots.push(outside);
    await symlink(outside, path.join(root, "junction"), "junction");
    await writeFile(path.join(outside, "keep.txt"), "kept");
    await service.cleanup(new Set(), new Date());
    expect(await readFile(path.join(outside, "keep.txt"), "utf8")).toBe("kept");
  });
});
