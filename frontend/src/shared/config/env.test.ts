import { describe, expect, it, vi } from "vitest";

describe("image delivery", () => {
  it("preserves Cloudinary URLs and resolves existing upload paths against the backend", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.example.test/");
    vi.resetModules();
    const { imageUrl } = await import("./env");
    expect(imageUrl("/uploads/pizza-1.avif")).toBe("https://backend.example.test/uploads/pizza-1.avif");
    expect(imageUrl("/api/v1/uploads/existing.avif")).toBe("https://backend.example.test/api/v1/uploads/existing.avif");
    const remote = "https://res.cloudinary.com/account/image/upload/pizzastore/catalog/image.webp";
    expect(imageUrl(remote)).toBe(remote);
    expect(imageUrl(null)).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
