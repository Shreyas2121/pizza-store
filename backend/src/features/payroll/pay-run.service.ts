import type { AuthPrincipal } from "../auth/auth.types";
import type { Permission } from "../access/access.permissions";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import type { AuditWriter, PayrollAuditAction } from "../audit/audit.types";
import { buildPayRunCsv, payRunExportFilename } from "./pay-run.csv";
import payRunRepository, { PayRunRepository } from "./pay-run.repository";
import type { CreatePayRunInput, PayPayRunInput, PayRunsQuery, VoidPayRunInput } from "./pay-run.schemas";
import {
  calculatePayRunSnapshot,
  hashPayRunPayload,
  requireIndependentApprover,
  requireIndependentPayer,
  requirePayRunStatus,
  requireRecentPayrollAuthentication,
} from "./pay-run.policy";

const POLICY = {
  currency: "INR" as const,
  frequency: "monthly" as const,
  calculationBasis: "full_recurring_compensation_effective_on_period_end" as const,
  proration: false,
  demoOnly: true,
  boundary: "Portfolio demo only — not statutory payroll, tax, EPF, ESI, TDS, or filing advice.",
};

const uniqueViolation = (cause: unknown) =>
  typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
const idempotencyConflict = () => new AppError(
  "Idempotency-Key was already used with different pay-run data.", 409, "DUPLICATE_IDEMPOTENCY_KEY"
);
const periodConflict = () => new AppError(
  "A pay run already exists for this store and monthly period.", 409, "PAY_RUN_PERIOD_CONFLICT"
);

type PayRunCommandAction = "calculate" | "approve" | "pay" | "void";
type LockedRun = NonNullable<Awaited<ReturnType<PayRunRepository["findRun"]>>>;
const lifecycleAuditAction: Record<"calculated" | "approved" | "paid" | "voided", PayrollAuditAction> = {
  calculated: "payroll.pay_run_calculated",
  approved: "payroll.pay_run_approved",
  paid: "payroll.pay_run_paid",
  voided: "payroll.pay_run_voided",
};

export class PayRunService {
  constructor(
    private readonly repository: PayRunRepository = payRunRepository,
    private readonly audit: AuditWriter = auditService,
  ) {}

  async list(actor: AuthPrincipal, query: PayRunsQuery) {
    await authorizationService.requireStorePermission({ principal: actor, storeId: query.storeId, permission: "payroll.read" });
    return { ...(await this.repository.list(query)), policy: POLICY };
  }

  async get(actor: AuthPrincipal, id: number) {
    const identity = await this.repository.findRun(id);
    if (!identity) throw resourceNotFound();
    await this.authorizeResource(actor, identity.storeId, "payroll.read");
    const detail = await this.repository.detail(id);
    if (!detail) throw resourceNotFound();
    return { data: detail, policy: POLICY };
  }

  async exportCsv(actor: AuthPrincipal, id: number) {
    const result = await this.get(actor, id);
    return {
      body: buildPayRunCsv(result.data),
      filename: payRunExportFilename(result.data.run),
    };
  }

  async create(actor: AuthPrincipal, key: string, input: CreatePayRunInput) {
    const payloadHash = hashPayRunPayload(input);
    const existing = await this.repository.findByClientRequestId(key);
    if (existing) return this.requireCreateMatch(actor, existing, payloadHash);
    try {
      const run = await this.repository.transaction(async (tx) => {
        await authorizationService.requireStorePermission({
          principal: actor, storeId: input.storeId, permission: "payroll.manage", tx,
          lockMembership: actor.platformRole !== "admin",
        });
        if (!await this.repository.findStore(input.storeId, tx)) throw resourceNotFound();
        const created = await this.repository.create(tx, input, { clientRequestId: key, payloadHash, actorId: actor.userId });
        await this.audit.write({
          tx, actor, storeId: input.storeId,
          action: "payroll.pay_run_created", resourceType: "pay_run", resourceId: created.id,
          after: this.auditState(created),
        });
        return created;
      });
      return { data: { run, employees: [] }, policy: POLICY };
    } catch (cause) {
      if (!uniqueViolation(cause)) throw cause;
      const raced = await this.repository.findByClientRequestId(key);
      if (raced) return this.requireCreateMatch(actor, raced, payloadHash);
      throw periodConflict();
    }
  }

  calculate(actor: AuthPrincipal, id: number, key: string, now = new Date()) {
    return this.command(actor, id, "calculate", key, {}, "payroll.calculate", async (tx, run) => {
      requireRecentPayrollAuthentication(actor, now);
      requirePayRunStatus(run.status, ["draft"]);
      const source = await this.repository.calculationInputs(tx, run.storeId, run.periodEnd);
      if (source.some((employee) => employee.compensationVersionId === null)) {
        throw new AppError("Every eligible employee requires compensation effective on the period end.", 422, "PAY_RUN_COMPENSATION_MISSING");
      }
      if (source.some((employee) => !employee.components.some((component) => component.type === "earning"))) {
        throw new AppError("Every eligible employee requires at least one earning component.", 422, "PAY_RUN_COMPENSATION_INVALID");
      }
      const snapshot = calculatePayRunSnapshot(source.map((employee) => ({
        profileId: employee.profileId,
        compensationVersionId: employee.compensationVersionId!,
        employeeCode: employee.employeeCode,
        displayName: employee.displayName,
        components: employee.components,
      })));
      await this.repository.replaceSnapshot(tx, run.id, run.storeId, snapshot);
      return this.change(tx, actor, run, "calculated", {
        ...snapshot.totals,
        calculatedBy: actor.userId,
        calculatedAt: now,
      }, { employeeCount: snapshot.totals.employeeCount });
    });
  }

  approve(actor: AuthPrincipal, id: number, key: string, now = new Date()) {
    return this.command(actor, id, "approve", key, {}, "payroll.approve", async (tx, run) => {
      requireRecentPayrollAuthentication(actor, now);
      requirePayRunStatus(run.status, ["calculated"]);
      requireIndependentApprover(actor.userId, run);
      return this.change(tx, actor, run, "approved", { approvedBy: actor.userId, approvedAt: now });
    });
  }

  pay(actor: AuthPrincipal, id: number, key: string, input: PayPayRunInput, now = new Date()) {
    return this.command(actor, id, "pay", key, input, "payroll.pay", async (tx, run) => {
      requireRecentPayrollAuthentication(actor, now);
      requirePayRunStatus(run.status, ["approved"]);
      requireIndependentPayer(actor.userId, run);
      return this.change(tx, actor, run, "paid", {
        paidBy: actor.userId,
        paidAt: now,
        paymentReference: input.paymentReference,
      }, { paymentReferenceRecorded: true });
    });
  }

  void(actor: AuthPrincipal, id: number, key: string, input: VoidPayRunInput, now = new Date()) {
    return this.command(actor, id, "void", key, input, "payroll.manage", async (tx, run) => {
      requireRecentPayrollAuthentication(actor, now);
      requirePayRunStatus(run.status, ["draft", "calculated", "approved"]);
      return this.change(tx, actor, run, "voided", {
        voidedBy: actor.userId,
        voidedAt: now,
        voidReason: input.reason,
      }, { reasonRecorded: true });
    });
  }

  private async command(
    actor: AuthPrincipal,
    id: number,
    action: PayRunCommandAction,
    key: string,
    payload: unknown,
    permission: Permission,
    work: (tx: TransactionType, run: LockedRun) => Promise<LockedRun>,
  ) {
    const payloadHash = hashPayRunPayload({ action, payload });
    const prior = await this.repository.command(key);
    if (prior) return this.requireCommandMatch(actor, prior, id, action, payloadHash, permission);
    const identity = await this.repository.findRun(id);
    if (!identity) throw resourceNotFound();
    try {
      return await this.repository.transaction(async (tx) => {
        await this.authorizeResource(actor, identity.storeId, permission, tx, actor.platformRole !== "admin");
        const raced = await this.repository.command(key, tx);
        if (raced) return this.requireCommandMatch(actor, raced, id, action, payloadHash, permission, tx);
        const run = await this.repository.lockRun(tx, id);
        if (!run || run.storeId !== identity.storeId) throw resourceNotFound();
        if (run.version !== identity.version) {
          throw new AppError("Pay run changed while this command was being prepared.", 409, "CONCURRENT_PAY_RUN_MODIFICATION");
        }
        const updated = await work(tx, run);
        await this.repository.recordCommand(tx, {
          payRunId: id, action, idempotencyKey: key, payloadHash,
          resultVersion: updated.version, actorId: actor.userId,
        });
        const detail = await this.repository.detail(id, tx);
        if (!detail) throw resourceNotFound();
        return { data: detail, policy: POLICY };
      });
    } catch (cause) {
      if (!uniqueViolation(cause)) throw cause;
      const raced = await this.repository.command(key);
      if (!raced) throw idempotencyConflict();
      return this.requireCommandMatch(actor, raced, id, action, payloadHash, permission);
    }
  }

  private async change(
    tx: TransactionType,
    actor: AuthPrincipal,
    run: LockedRun,
    status: keyof typeof lifecycleAuditAction,
    values: Partial<LockedRun>,
    metadata?: Record<string, unknown>,
  ) {
    const updated = await this.repository.update(tx, run.id, {
      ...values,
      status,
      version: run.version + 1,
    });
    await this.audit.write({
      tx, actor, storeId: run.storeId,
      action: lifecycleAuditAction[status],
      resourceType: "pay_run", resourceId: run.id,
      before: this.auditState(run), after: this.auditState(updated), metadata,
    });
    return updated;
  }

  private async requireCreateMatch(actor: AuthPrincipal, run: LockedRun, payloadHash: string) {
    await this.authorizeResource(actor, run.storeId, "payroll.manage");
    if (run.payloadHash !== payloadHash) throw idempotencyConflict();
    const detail = await this.repository.detail(run.id);
    if (!detail) throw resourceNotFound();
    return { data: detail, policy: POLICY };
  }

  private async requireCommandMatch(
    actor: AuthPrincipal,
    command: NonNullable<Awaited<ReturnType<PayRunRepository["command"]>>>,
    id: number,
    action: PayRunCommandAction,
    payloadHash: string,
    permission: Permission,
    tx?: TransactionType,
  ) {
    const run = await this.repository.findRun(command.payRunId, tx);
    if (!run) throw resourceNotFound();
    await this.authorizeResource(actor, run.storeId, permission, tx);
    if (command.payRunId !== id || command.action !== action || command.payloadHash !== payloadHash) throw idempotencyConflict();
    const detail = await this.repository.detail(id, tx);
    if (!detail) throw resourceNotFound();
    return { data: detail, policy: POLICY };
  }

  private authorizeResource(
    actor: AuthPrincipal,
    storeId: number,
    permission: Permission,
    tx?: TransactionType,
    lockMembership = false,
  ) {
    return authorizationService.requireResourceStorePermission({
      principal: actor, resourceStoreId: storeId, permission, tx, lockMembership,
    });
  }

  private auditState(run: { status: string; version: number; periodStart: string; periodEnd: string; employeeCount: number | null }) {
    return {
      status: run.status,
      version: run.version,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      employeeCount: run.employeeCount,
    };
  }
}

export default new PayRunService();
