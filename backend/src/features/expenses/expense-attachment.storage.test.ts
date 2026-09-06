import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalExpenseReceiptStorage } from "./expense-attachment.storage";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
describe("local private receipt storage", () => {
  it("uses generated keys and refuses traversal", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "expense-receipts-")); roots.push(root);
    const storage = new LocalExpenseReceiptStorage(root); const content = Buffer.from("%PDF-1.7\nreceipt");
    const key = await storage.put(content, ".pdf");
    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/); expect(await storage.read(key)).toEqual(content);
    await expect(storage.read("../uploads/secret.pdf")).rejects.toMatchObject({ code: "INVALID_RECEIPT_STORAGE_KEY" });
  });
});
