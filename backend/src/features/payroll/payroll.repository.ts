import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import { db } from "../../db";
import {
  compensationComponentsTable,
  compensationVersionsTable,
  employeeFinanceProfilesTable,
  storesTable,
  usersTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import type {
  CompensationVersionsQuery,
  CreateCompensationVersionInput,
  CreatePayrollProfileInput,
  PayrollProfilesQuery,
} from "./payroll.schemas";

const safeProfileSelection = {
  id: employeeFinanceProfilesTable.id,
  storeId: employeeFinanceProfilesTable.storeId,
  userId: employeeFinanceProfilesTable.userId,
  employeeCode: employeeFinanceProfilesTable.employeeCode,
  displayName: employeeFinanceProfilesTable.displayName,
  employmentStartDate: employeeFinanceProfilesTable.employmentStartDate,
  employmentEndDate: employeeFinanceProfilesTable.employmentEndDate,
  status: employeeFinanceProfilesTable.status,
  payFrequency: employeeFinanceProfilesTable.payFrequency,
  bankAccountLast4: employeeFinanceProfilesTable.bankAccountLast4,
  taxIdentifierLast4: employeeFinanceProfilesTable.taxIdentifierLast4,
  createdAt: employeeFinanceProfilesTable.createdAt,
  updatedAt: employeeFinanceProfilesTable.updatedAt,
};

export class PayrollRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) { return db.transaction(work); }

  async findStore(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.id, id)))[0];
  }

  async findUser(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)))[0];
  }

  async findProfileIdentity(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select({ id: employeeFinanceProfilesTable.id, storeId: employeeFinanceProfilesTable.storeId })
      .from(employeeFinanceProfilesTable).where(eq(employeeFinanceProfilesTable.id, id)))[0];
  }

  async findProfile(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select(safeProfileSelection).from(employeeFinanceProfilesTable)
      .where(eq(employeeFinanceProfilesTable.id, id)))[0];
  }

  async lockProfile(tx: TransactionType, id: number) {
    return (await tx.select().from(employeeFinanceProfilesTable)
      .where(eq(employeeFinanceProfilesTable.id, id)).for("update"))[0];
  }

  async listProfiles(query: PayrollProfilesQuery) {
    const conditions: SQL[] = [eq(employeeFinanceProfilesTable.storeId, query.storeId)];
    if (query.status) conditions.push(eq(employeeFinanceProfilesTable.status, query.status));
    if (query.search) {
      const search = `%${query.search}%`;
      conditions.push(or(ilike(employeeFinanceProfilesTable.displayName, search), ilike(employeeFinanceProfilesTable.employeeCode, search))!);
    }
    const where = and(...conditions);
    const [{ total }] = await db.select({ total: count() }).from(employeeFinanceProfilesTable).where(where);
    const items = await db.select(safeProfileSelection).from(employeeFinanceProfilesTable).where(where)
      .orderBy(asc(employeeFinanceProfilesTable.displayName), asc(employeeFinanceProfilesTable.id))
      .limit(query.limit).offset((query.page - 1) * query.limit);
    const parsed = Number(total);
    return { items, meta: { total: parsed, page: query.page, limit: query.limit, totalPages: Math.ceil(parsed / query.limit), hasNextPage: query.page * query.limit < parsed } };
  }

  async createProfile(tx: TransactionType, input: CreatePayrollProfileInput, sensitive: {
    bankAccountEncrypted: string | null;
    bankAccountLast4: string | null;
    taxIdentifierEncrypted: string | null;
    taxIdentifierLast4: string | null;
  }, actorId: number) {
    return (await tx.insert(employeeFinanceProfilesTable).values({
      storeId: input.storeId,
      userId: input.userId ?? null,
      employeeCode: input.employeeCode,
      displayName: input.displayName,
      employmentStartDate: input.employmentStartDate,
      employmentEndDate: input.employmentEndDate ?? null,
      status: input.status,
      payFrequency: input.payFrequency,
      ...sensitive,
      createdBy: actorId,
      updatedBy: actorId,
    }).returning())[0];
  }

  async updateProfile(tx: TransactionType, id: number, values: Partial<typeof employeeFinanceProfilesTable.$inferInsert>) {
    return (await tx.update(employeeFinanceProfilesTable).set({ ...values, updatedAt: new Date() })
      .where(eq(employeeFinanceProfilesTable.id, id)).returning())[0];
  }

  async findCompensationOverlap(tx: TransactionType, profileId: number, effectiveFrom: string, effectiveTo?: string | null) {
    return (await tx.select({ id: compensationVersionsTable.id }).from(compensationVersionsTable).where(and(
      eq(compensationVersionsTable.profileId, profileId),
      effectiveTo ? lte(compensationVersionsTable.effectiveFrom, effectiveTo) : undefined,
      or(isNull(compensationVersionsTable.effectiveTo), gte(compensationVersionsTable.effectiveTo, effectiveFrom)),
    )).limit(1))[0];
  }

  async createCompensationVersion(tx: TransactionType, profileId: number, storeId: number, input: CreateCompensationVersionInput, actorId: number) {
    const version = (await tx.insert(compensationVersionsTable).values({
      profileId,
      storeId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
      currency: "INR",
      sourceNote: input.sourceNote ?? null,
      demoOnly: true,
      createdBy: actorId,
    }).returning())[0];
    const components = await tx.insert(compensationComponentsTable).values(input.components.map((component) => ({
      compensationVersionId: version.id,
      ...component,
    }))).returning();
    return { version, components };
  }

  async listCompensationVersions(profileId: number, query: CompensationVersionsQuery) {
    const conditions: SQL[] = [eq(compensationVersionsTable.profileId, profileId)];
    if (query.asOf) {
      conditions.push(lte(compensationVersionsTable.effectiveFrom, query.asOf));
      conditions.push(or(isNull(compensationVersionsTable.effectiveTo), gte(compensationVersionsTable.effectiveTo, query.asOf))!);
    }
    const versions = await db.select().from(compensationVersionsTable).where(and(...conditions))
      .orderBy(desc(compensationVersionsTable.effectiveFrom), desc(compensationVersionsTable.id));
    if (!versions.length) return [];
    const components = await db.select().from(compensationComponentsTable)
      .where(inArray(compensationComponentsTable.compensationVersionId, versions.map((version) => version.id)))
      .orderBy(asc(compensationComponentsTable.compensationVersionId), asc(compensationComponentsTable.type), asc(compensationComponentsTable.id));
    return versions.map((version) => ({
      version,
      components: components.filter((component) => component.compensationVersionId === version.id),
    }));
  }
}

export default new PayrollRepository();
