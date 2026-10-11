import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { initializeStorage, receiptsDirectory, uploadsDirectory } from "./storage-paths";

let root: string;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (root) await rm(root, { recursive: true, force: true });
}, 20_000);

it("initializes a fresh persistent disk and preserves existing files on restart", async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "pizzastore-storage-"));
  vi.stubEnv("DATA_DIRECTORY", root);
  await initializeStorage();
  const image = path.join(uploadsDirectory(), "pizza-1.avif");
  expect((await readFile(image)).length).toBeGreaterThan(0);
  await writeFile(image, "existing upload");
  const receipt = path.join(receiptsDirectory(), "existing.pdf");
  await writeFile(receipt, "private receipt");
  await initializeStorage();
  expect(await readFile(image, "utf8")).toBe("existing upload");
  expect(await readFile(receipt, "utf8")).toBe("private receipt");
}, 20_000);
