import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import ledgerAdminService from "./ledger-admin.service";
import { createFiscalPeriodSchema, journalsQuerySchema, ledgerIdempotencyKeySchema, ledgerStoreQuerySchema, manualJournalSchema, periodTransitionSchema, reverseJournalSchema, trialBalanceQuerySchema } from "./ledger.schemas";
import { auditHighRiskOperation as highRisk } from "../audit/high-risk-audit.middleware";

export const ledgerRoutes = Router();
ledgerRoutes.use(authenticateUser);

ledgerRoutes.get("/ledger/accounts", asyncHandler(async (req: Auth, res) => { const { storeId } = ledgerStoreQuerySchema.parse(req.query); res.json({ data: await ledgerAdminService.accounts(req.principal!, storeId), policy: { currency: "INR", chartScope: "owner_business" } }); }));
ledgerRoutes.get("/ledger/journals", asyncHandler(async (req: Auth, res) => { const result = await ledgerAdminService.journals(req.principal!, journalsQuerySchema.parse(req.query)); res.json({ data: result.items, meta: result.meta }); }));
ledgerRoutes.get("/ledger/trial-balance", asyncHandler(async (req: Auth, res) => { res.json({ data: await ledgerAdminService.trialBalance(req.principal!, trialBalanceQuerySchema.parse(req.query)) }); }));
ledgerRoutes.get("/ledger/periods", asyncHandler(async (req: Auth, res) => { const { storeId } = ledgerStoreQuerySchema.parse(req.query); res.json({ data: await ledgerAdminService.periods(req.principal!, storeId) }); }));
ledgerRoutes.get("/ledger/journals/:journalId", asyncHandler(async (req: Auth, res) => { res.json({ data: await ledgerAdminService.journal(req.principal!, parseIntegerParam(req.params.journalId, "Journal ID")) }); }));

ledgerRoutes.post("/ledger/periods", highRisk({ operation: "ledger.period_open", resourceType: "fiscal_period", resourceId: () => "new", storeId: (req) => req.body?.storeId }), validateBody(createFiscalPeriodSchema), asyncHandler(async (req: Auth, res) => { res.status(201).json({ data: await ledgerAdminService.openPeriod(req.principal!, req.body) }); }));
ledgerRoutes.post("/ledger/periods/:periodId/soft-close", highRisk({ operation: "ledger.period_soft_close", resourceType: "fiscal_period", resourceId: (req) => req.params.periodId }), validateBody(periodTransitionSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await ledgerAdminService.softClosePeriod(req.principal!, parseIntegerParam(req.params.periodId, "Period ID"), req.body.reason) }); }));
ledgerRoutes.post("/ledger/periods/:periodId/close", highRisk({ operation: "ledger.period_close", resourceType: "fiscal_period", resourceId: (req) => req.params.periodId }), validateBody(periodTransitionSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await ledgerAdminService.closePeriod(req.principal!, parseIntegerParam(req.params.periodId, "Period ID"), req.body.reason) }); }));
ledgerRoutes.post("/ledger/periods/:periodId/reopen", highRisk({ operation: "ledger.period_reopen", resourceType: "fiscal_period", resourceId: (req) => req.params.periodId }), validateBody(periodTransitionSchema), asyncHandler(async (req: Auth, res) => { res.json({ data: await ledgerAdminService.reopenPeriod(req.principal!, parseIntegerParam(req.params.periodId, "Period ID"), req.body.reason) }); }));
ledgerRoutes.post("/ledger/manual-journals", highRisk({ operation: "ledger.manual_journal_post", resourceType: "journal_entry", resourceId: () => "new", storeId: (req) => req.body?.storeId }), validateBody(manualJournalSchema), asyncHandler(async (req: Auth, res) => { const key = ledgerIdempotencyKeySchema.parse(req.get("Idempotency-Key")); res.status(201).json({ data: await ledgerAdminService.postManual(req.principal!, key, req.body) }); }));
ledgerRoutes.post("/ledger/journals/:journalId/reverse", highRisk({ operation: "ledger.manual_journal_reverse", resourceType: "journal_entry", resourceId: (req) => req.params.journalId }), validateBody(reverseJournalSchema), asyncHandler(async (req: Auth, res) => { res.status(201).json({ data: await ledgerAdminService.reverseJournal(req.principal!, parseIntegerParam(req.params.journalId, "Journal ID"), req.body) }); }));
