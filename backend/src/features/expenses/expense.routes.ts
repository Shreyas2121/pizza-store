import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import expenseService from "./expense.service";
import { emptyExpenseCommandSchema, expenseIdempotencyKeySchema, expensesQuerySchema, expenseWriteSchema, payExpenseSchema, rejectExpenseSchema, reverseExpenseSchema, updateExpenseSchema, voidExpenseSchema } from "./expense.schemas";

export const expenseRoutes = Router();
expenseRoutes.use(authenticateUser);
const id = (req: Auth) => parseIntegerParam(req.params.expenseId, "Expense ID");
const key = (req: Auth) => expenseIdempotencyKeySchema.parse(req.get("Idempotency-Key"));

expenseRoutes.get("/expenses", asyncHandler(async (req: Auth, res) => { const result = await expenseService.list(req.principal!, expensesQuerySchema.parse(req.query)); res.json({ data: result.items, meta: result.meta }); }));
expenseRoutes.get("/expenses/:expenseId", asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.get(req.principal!, id(req)) }); }));
expenseRoutes.post("/expenses", validateBody(expenseWriteSchema), asyncHandler(async (req: Auth, res) => { res.status(201).json({ data: await expenseService.create(req.principal!, key(req), req.body) }); }));
expenseRoutes.put("/expenses/:expenseId", validateBody(updateExpenseSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.update(req.principal!, id(req), req.body) }); }));
expenseRoutes.post("/expenses/:expenseId/submit", validateBody(emptyExpenseCommandSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.submit(req.principal!, id(req), key(req)) }); }));
expenseRoutes.post("/expenses/:expenseId/approve", validateBody(emptyExpenseCommandSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.approve(req.principal!, id(req), key(req)) }); }));
expenseRoutes.post("/expenses/:expenseId/reject", validateBody(rejectExpenseSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.reject(req.principal!, id(req), key(req), req.body.reason) }); }));
expenseRoutes.post("/expenses/:expenseId/pay", validateBody(payExpenseSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.pay(req.principal!, id(req), key(req), req.body) }); }));
expenseRoutes.post("/expenses/:expenseId/post", validateBody(emptyExpenseCommandSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.post(req.principal!, id(req), key(req)) }); }));
expenseRoutes.post("/expenses/:expenseId/void", validateBody(voidExpenseSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.void(req.principal!, id(req), key(req), req.body) }); }));
expenseRoutes.post("/expenses/:expenseId/reverse", validateBody(reverseExpenseSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await expenseService.reverse(req.principal!, id(req), key(req), req.body.reason) }); }));
