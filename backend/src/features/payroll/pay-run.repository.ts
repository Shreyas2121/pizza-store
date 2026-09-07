import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import { db } from "../../db";
import {
  compensationComponentsTable,
  compensationVersionsTable,
  employeeFinanceProfilesTable,
  payRunCommandsTable,
  payRunEmployeesTable,
  payRunLinesTable,
  payRunsTable,
  storesTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import type { CreatePayRunInput, PayRunsQuery } from "./pay-run.schemas";
import type { calculatePayRunSnapshot } from "./pay-run.policy";

type CalculatedSnapshot = ReturnType<typeof calculatePayRunSnapshot>;

const listSelection = {
  id: payRunsTable.id,
  storeId: payRunsTable.storeId,
  periodStart: payRunsTable.periodStart,
  periodEnd: payRunsTable.periodEnd,
  status: payRunsTable.status,
  currency: payRunsTable.currency,
  demoOnly: payRunsTable.demoOnly,
  employeeCount: payRunsTable.employeeCount,
  grossPayPaise: payRunsTable.grossPayPaise,
  deductionPaise: payRunsTable.deductionPaise,
  netPayPaise: payRunsTable.netPayPaise,
  employerCostPaise: payRunsTable.employerCostPaise,
  totalEmployerCostPaise: payRunsTable.totalEmployerCostPaise,
  version: payRunsTable.version,
  createdAt: payRunsTable.createdAt,
  updatedAt: payRunsTable.updatedAt,
};

export class PayRunRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) { return db.transaction(work); }

  async findStore(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select({ id: storesTable.id, timezone: storesTable.timezone }).from(storesTable).where(eq(storesTable.id, id)))[0];
  }

  async findRun(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(payRunsTable).where(eq(payRunsTable.id, id)))[0];
  }

  async findByClientRequestId(clientRequestId: string, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(payRunsTable).where(eq(payRunsTable.clientRequestId, clientRequestId)))[0];
  }

  async lockRun(tx: TransactionType, id: number) {
    return (await tx.select().from(payRunsTable).where(eq(payRunsTable.id, id)).for("update"))[0];
  }

  async list(query: PayRunsQuery) {
    const conditions: SQL[] = [eq(payRunsTable.storeId, query.storeId)];
    if (query.status) conditions.push(eq(payRunsTable.status, query.status));
    if (query.from) conditions.push(gte(payRunsTable.periodEnd, query.from));
    if (query.to) conditions.push(lte(payRunsTable.periodStart, query.to));
    const where = and(...conditions);
    const [{ total }] = await db.select({ total: count() }).from(payRunsTable).where(where);
    const items = await db.select(listSelection).from(payRunsTable).where(where)
      .orderBy(desc(payRunsTable.periodStart), desc(payRunsTable.id))
      .limit(query.limit).offset((query.page - 1) * query.limit);
    const parsed = Number(total);
    return { items, meta: { total: parsed, page: query.page, limit: query.limit, totalPages: Math.ceil(parsed / query.limit), hasNextPage: query.page * query.limit < parsed } };
  }

  async create(tx: TransactionType, input: CreatePayRunInput, values: { clientRequestId: string; payloadHash: string; actorId: number }) {
    return (await tx.insert(payRunsTable).values({
      storeId: input.storeId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      clientRequestId: values.clientRequestId,
      payloadHash: values.payloadHash,
      createdBy: values.actorId,
    }).returning())[0];
  }

  async update(tx: TransactionType, id: number, values: Partial<typeof payRunsTable.$inferInsert>) {
    return (await tx.update(payRunsTable).set({ ...values, updatedAt: new Date() }).where(eq(payRunsTable.id, id)).returning())[0];
  }

  async calculationInputs(tx: TransactionType, storeId: number, asOf: string) {
    const rows = await tx.select({
      profileId: employeeFinanceProfilesTable.id,
      employeeCode: employeeFinanceProfilesTable.employeeCode,
      displayName: employeeFinanceProfilesTable.displayName,
      compensationVersionId: compensationVersionsTable.id,
    }).from(employeeFinanceProfilesTable)
      .leftJoin(compensationVersionsTable, and(
        eq(compensationVersionsTable.profileId, employeeFinanceProfilesTable.id),
        lte(compensationVersionsTable.effectiveFrom, asOf),
        or(isNull(compensationVersionsTable.effectiveTo), gte(compensationVersionsTable.effectiveTo, asOf)),
      ))
      .where(and(
        eq(employeeFinanceProfilesTable.storeId, storeId),
        lte(employeeFinanceProfilesTable.employmentStartDate, asOf),
        or(isNull(employeeFinanceProfilesTable.employmentEndDate), gte(employeeFinanceProfilesTable.employmentEndDate, asOf)),
      ))
      .orderBy(asc(employeeFinanceProfilesTable.id));
    const versionIds = rows.flatMap((row) => row.compensationVersionId === null ? [] : [row.compensationVersionId]);
    const components = versionIds.length
      ? await tx.select().from(compensationComponentsTable)
        .where(inArray(compensationComponentsTable.compensationVersionId, versionIds))
        .orderBy(asc(compensationComponentsTable.compensationVersionId), asc(compensationComponentsTable.type), asc(compensationComponentsTable.code), asc(compensationComponentsTable.id))
      : [];
    return rows.map((row) => ({
      ...row,
      components: row.compensationVersionId === null
        ? []
        : components.filter((component) => component.compensationVersionId === row.compensationVersionId),
    }));
  }

  async replaceSnapshot(tx: TransactionType, payRunId: number, storeId: number, snapshot: CalculatedSnapshot) {
    await tx.delete(payRunEmployeesTable).where(eq(payRunEmployeesTable.payRunId, payRunId));
    for (const employee of snapshot.employees) {
      const [created] = await tx.insert(payRunEmployeesTable).values({
        payRunId,
        payRunStoreId: storeId,
        profileId: employee.profileId,
        compensationVersionId: employee.compensationVersionId,
        employeeCode: employee.employeeCode,
        displayName: employee.displayName,
        grossPayPaise: employee.grossPayPaise,
        deductionPaise: employee.deductionPaise,
        netPayPaise: employee.netPayPaise,
        employerCostPaise: employee.employerCostPaise,
        totalEmployerCostPaise: employee.totalEmployerCostPaise,
      }).returning({ id: payRunEmployeesTable.id });
      await tx.insert(payRunLinesTable).values(employee.lines.map((line) => ({
        payRunEmployeeId: created.id,
        ...line,
      })));
    }
  }

  async detail(id: number, executor: typeof db | TransactionType = db) {
    const run = await this.findRun(id, executor);
    if (!run) return undefined;
    const employees = await executor.select().from(payRunEmployeesTable)
      .where(eq(payRunEmployeesTable.payRunId, id)).orderBy(asc(payRunEmployeesTable.id));
    const employeeIds = employees.map((employee) => employee.id);
    const lines = employeeIds.length
      ? await executor.select().from(payRunLinesTable).where(inArray(payRunLinesTable.payRunEmployeeId, employeeIds))
        .orderBy(asc(payRunLinesTable.payRunEmployeeId), asc(payRunLinesTable.type), asc(payRunLinesTable.id))
      : [];
    return {
      run,
      employees: employees.map((employee) => ({
        ...employee,
        lines: lines.filter((line) => line.payRunEmployeeId === employee.id),
      })),
    };
  }

  async command(idempotencyKey: string, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(payRunCommandsTable).where(eq(payRunCommandsTable.idempotencyKey, idempotencyKey)))[0];
  }

  async recordCommand(tx: TransactionType, values: {
    payRunId: number;
    action: "calculate" | "approve" | "pay" | "post" | "void" | "reverse";
    idempotencyKey: string;
    payloadHash: string;
    resultVersion: number;
    actorId: number;
  }) {
    return (await tx.insert(payRunCommandsTable).values(values).returning())[0];
  }
}

export default new PayRunRepository();
