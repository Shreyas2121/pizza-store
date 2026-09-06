import type { AuthPrincipal } from "../auth/auth.types";
import { AppError } from "../../utils/error";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import expenseRepository, { ExpenseRepository } from "./expense.repository";
import receiptStorage, { type ExpenseReceiptStorage } from "./expense-attachment.storage";
import { validateExpenseReceipt } from "./expense-attachment.policy";
import { requireExpenseStatus } from "./expense.policy";
import type { ExpenseAttachment } from "../../db/schema";

const dto = (attachment: ExpenseAttachment) => ({ id: attachment.id, expenseId: attachment.expenseId, expenseStoreId: attachment.expenseStoreId, originalName: attachment.originalName, mediaType: attachment.mediaType, sizeBytes: attachment.sizeBytes, sha256: attachment.sha256, uploadedBy: attachment.uploadedBy, createdAt: attachment.createdAt });

export class ExpenseAttachmentService {
  constructor(private readonly repository: ExpenseRepository = expenseRepository, private readonly storage: ExpenseReceiptStorage = receiptStorage) {}

  async list(actor: AuthPrincipal, expenseId: number) {
    const expense = await this.repository.findExpense(expenseId); if (!expense) throw resourceNotFound();
    await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: expense.storeId, permission: "finance.expenses.read" });
    return (await this.repository.attachments(expenseId)).map(dto);
  }

  async upload(actor: AuthPrincipal, expenseId: number, file: Express.Multer.File | undefined) {
    if (!file) throw new AppError("A receipt file is required.", 422, "RECEIPT_REQUIRED");
    const expense = await this.repository.findExpense(expenseId); if (!expense) throw resourceNotFound();
    await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: expense.storeId, permission: "finance.expenses.create" });
    const validated = validateExpenseReceipt(file);
    const storageKey = await this.storage.put(file.buffer, validated.extension);
    try {
      const attachment = await this.repository.transaction(async (tx) => {
        await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: expense.storeId, permission: "finance.expenses.create", tx, lockMembership: actor.platformRole !== "admin" });
        const current = await this.repository.lockExpense(tx, expenseId); if (!current) throw resourceNotFound();
        requireExpenseStatus(current.status, ["draft", "rejected"]);
        const created = await this.repository.createAttachment(tx, { expenseId, expenseStoreId: current.storeId, storageKey, originalName: validated.originalName, mediaType: validated.mediaType, sizeBytes: validated.sizeBytes, sha256: validated.sha256, uploadedBy: actor.userId });
        await auditService.write({ tx, actor, storeId: current.storeId, action: "expense.attachment_uploaded", resourceType: "expense_attachment", resourceId: created.id, after: { expenseId, mediaType: created.mediaType, sizeBytes: created.sizeBytes, sha256: created.sha256 } });
        return created;
      });
      return dto(attachment);
    } catch (cause) {
      await this.storage.delete(storageKey);
      if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505") throw new AppError("This receipt is already attached to the expense.", 409, "DUPLICATE_EXPENSE_RECEIPT");
      throw cause;
    }
  }

  async download(actor: AuthPrincipal, expenseId: number, attachmentId: number) {
    const expense = await this.repository.findExpense(expenseId); if (!expense) throw resourceNotFound();
    await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: expense.storeId, permission: "finance.expenses.read" });
    const attachment = await this.repository.attachment(expenseId, attachmentId); if (!attachment) throw resourceNotFound();
    return { attachment: dto(attachment), buffer: await this.storage.read(attachment.storageKey) };
  }
}

export default new ExpenseAttachmentService();
