import { beforeEach, describe, expect, it, vi } from "vitest";
import authorizationService from "../access/access.service";
import auditService from "../audit/audit.service";
import { ExpenseAttachmentService } from "./expense-attachment.service";

const actor = { userId: 9, email: "finance@example.com", platformRole: "user" as const, tokenVersion: 1 };
const expense = { id: 4, storeId: 1, status: "draft" };
const attachment = { id: 8, expenseId: 4, expenseStoreId: 1, storageKey: "00000000-0000-4000-8000-000000000000.pdf", originalName: "receipt.pdf", mediaType: "application/pdf", sizeBytes: 16, sha256: "a".repeat(64), uploadedBy: 9, createdAt: new Date() };

describe("expense attachment service", () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({ access: "membership", userId: 9, storeId: 1, membershipId: 2, membershipRole: "finance_manager", permission: "finance.expenses.read" }); vi.spyOn(auditService, "write").mockResolvedValue(); });
  it("authorizes every download before reading its private storage key", async () => {
    const repository = { findExpense: vi.fn().mockResolvedValue(expense), attachment: vi.fn().mockResolvedValue(attachment) };
    const storage = { read: vi.fn().mockResolvedValue(Buffer.from("receipt")), put: vi.fn(), delete: vi.fn() };
    const result = await new ExpenseAttachmentService(repository as never, storage).download(actor, 4, 8);
    expect(authorizationService.requireResourceStorePermission).toHaveBeenCalledWith(expect.objectContaining({ resourceStoreId: 1, permission: "finance.expenses.read" }));
    expect(storage.read).toHaveBeenCalledWith(attachment.storageKey); expect(result.attachment).not.toHaveProperty("storageKey");
  });
  it("removes a newly stored file when metadata creation fails", async () => {
    const repository = { findExpense: vi.fn().mockResolvedValue(expense), transaction: (work: (tx: object) => Promise<unknown>) => work({}), lockExpense: vi.fn().mockResolvedValue(expense), createAttachment: vi.fn().mockRejectedValue(new Error("database unavailable")) };
    const storage = { read: vi.fn(), put: vi.fn().mockResolvedValue(attachment.storageKey), delete: vi.fn().mockResolvedValue(undefined) };
    const file = { originalname: "receipt.pdf", mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.7\nreceipt") } as Express.Multer.File; file.size = file.buffer.length;
    await expect(new ExpenseAttachmentService(repository as never, storage).upload(actor, 4, file)).rejects.toThrow("database unavailable");
    expect(storage.delete).toHaveBeenCalledWith(attachment.storageKey);
  });
});
