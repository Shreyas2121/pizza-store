import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { AppError } from "../../utils/error";

export interface ExpenseReceiptStorage {
  put(buffer: Buffer, extension: string): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

export class LocalExpenseReceiptStorage implements ExpenseReceiptStorage {
  private readonly root: string;
  constructor(root = path.resolve(process.cwd(), ".private", "expense-receipts")) { this.root = path.resolve(root); }

  async put(buffer: Buffer, extension: string) {
    const storageKey = `${randomUUID()}${extension}`;
    await mkdir(this.root, { recursive: true });
    await writeFile(this.resolveKey(storageKey), buffer, { flag: "wx", mode: 0o600 });
    return storageKey;
  }
  async read(storageKey: string) {
    try { return await readFile(this.resolveKey(storageKey)); }
    catch (cause) { if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT") throw new AppError("Receipt file is unavailable.", 404, "RECEIPT_FILE_NOT_FOUND"); throw cause; }
  }
  async delete(storageKey: string) {
    try { await unlink(this.resolveKey(storageKey)); }
    catch (cause) { if (!(typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT")) throw cause; }
  }
  private resolveKey(storageKey: string) {
    if (!/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(storageKey)) throw new AppError("Receipt storage key is invalid.", 500, "INVALID_RECEIPT_STORAGE_KEY");
    const resolved = path.resolve(this.root, storageKey);
    if (path.dirname(resolved) !== this.root) throw new AppError("Receipt storage path is invalid.", 500, "INVALID_RECEIPT_STORAGE_PATH");
    return resolved;
  }
}

export default new LocalExpenseReceiptStorage();
