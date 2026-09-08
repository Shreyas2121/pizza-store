import { Router, type RequestHandler } from "express";
import multer from "multer";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { AppError, asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import expenseService from "./expense.service";
import { emptyExpenseCommandSchema, expenseIdempotencyKeySchema, expensesQuerySchema, expenseWriteSchema, payExpenseSchema, rejectExpenseSchema, reverseExpenseSchema, sourceMarginQuerySchema, updateExpenseSchema, voidExpenseSchema } from "./expense.schemas";
import expenseAttachmentService from "./expense-attachment.service";
import { MAX_EXPENSE_RECEIPT_BYTES } from "./expense-attachment.policy";
import { auditHighRiskOperation as highRisk } from "../audit/high-risk-audit.middleware";

export const expenseRoutes = Router();
expenseRoutes.use(authenticateUser);
const id = (req: Auth) => parseIntegerParam(req.params.expenseId, "Expense ID");
const key = (req: Auth) => expenseIdempotencyKeySchema.parse(req.get("Idempotency-Key"));
const receiptUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_EXPENSE_RECEIPT_BYTES, files: 1, fields: 0 }, fileFilter: (_req, file, callback) => ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.mimetype) ? callback(null, true) : callback(new AppError("Receipt must be a PDF, JPEG, PNG, or WebP file.", 422, "INVALID_RECEIPT_TYPE")) });
const receiveReceipt: RequestHandler = (req, res, next) => receiptUpload.single("receipt")(req, res, (cause) => {
  if (cause instanceof multer.MulterError && cause.code === "LIMIT_FILE_SIZE") return next(new AppError("Receipt must not exceed 5 MiB.", 413, "INVALID_RECEIPT_SIZE"));
  if (cause) return next(cause);
  next();
});

expenseRoutes.get("/expenses", asyncHandler(async (req: Auth, res) => { const result = await expenseService.list(req.principal!, expensesQuerySchema.parse(req.query)); res.json({ data: result.items, meta: result.meta }); }));
expenseRoutes.get("/source-margin", asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.sourceMargin(req.principal!, sourceMarginQuerySchema.parse(req.query)) }); }));
expenseRoutes.get("/expenses/:expenseId", asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.get(req.principal!, id(req)) }); }));
expenseRoutes.post("/expenses", validateBody(expenseWriteSchema), asyncHandler(async (req: Auth, res) => { res.status(201).json({ data: await expenseService.create(req.principal!, key(req), req.body) }); }));
expenseRoutes.put("/expenses/:expenseId", validateBody(updateExpenseSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.update(req.principal!, id(req), req.body) }); }));
expenseRoutes.get("/expenses/:expenseId/attachments", asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseAttachmentService.list(req.principal!, id(req)) }); }));
expenseRoutes.post("/expenses/:expenseId/attachments", receiveReceipt, asyncHandler(async (req: Auth, res) => { res.status(201).json({ data: await expenseAttachmentService.upload(req.principal!, id(req), req.file) }); }));
expenseRoutes.get("/expenses/:expenseId/attachments/:attachmentId", asyncHandler(async (req: Auth, res) => {
  const result = await expenseAttachmentService.download(req.principal!, id(req), parseIntegerParam(req.params.attachmentId, "Attachment ID"));
  const filename = encodeURIComponent(result.attachment.originalName).replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  res.setHeader("Content-Type", result.attachment.mediaType);
  res.setHeader("Content-Length", result.attachment.sizeBytes);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(result.buffer);
}));
expenseRoutes.post("/expenses/:expenseId/submit", validateBody(emptyExpenseCommandSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.submit(req.principal!, id(req), key(req)) }); }));
expenseRoutes.post("/expenses/:expenseId/approve", highRisk({ operation: "expense.approve", resourceType: "expense", resourceId: (req) => req.params.expenseId }), validateBody(emptyExpenseCommandSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.approve(req.principal!, id(req), key(req)) }); }));
expenseRoutes.post("/expenses/:expenseId/reject", validateBody(rejectExpenseSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.reject(req.principal!, id(req), key(req), req.body.reason) }); }));
expenseRoutes.post("/expenses/:expenseId/pay", highRisk({ operation: "expense.pay", resourceType: "expense", resourceId: (req) => req.params.expenseId }), validateBody(payExpenseSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.pay(req.principal!, id(req), key(req), req.body) }); }));
expenseRoutes.post("/expenses/:expenseId/post", validateBody(emptyExpenseCommandSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.post(req.principal!, id(req), key(req)) }); }));
expenseRoutes.post("/expenses/:expenseId/void", validateBody(voidExpenseSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.void(req.principal!, id(req), key(req), req.body) }); }));
expenseRoutes.post("/expenses/:expenseId/reverse", validateBody(reverseExpenseSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.reverse(req.principal!, id(req), key(req), req.body.reason) }); }));
