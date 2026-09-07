import type { AuthPrincipal } from "../auth/auth.types";
import { AppError } from "../../utils/error";
import { addPaise, MONEY_CAPS, subtractPaise } from "../../utils/money";
import type { TransactionType } from "../../utils/types";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import payrollRepository, { PayrollRepository } from "./payroll.repository";
import payrollSensitiveData, { maskSensitiveLast4, type SensitiveDataProtector } from "./payroll-sensitive-data";
import type {
  CompensationVersionsQuery,
  CreateCompensationVersionInput,
  CreatePayrollProfileInput,
  PayrollProfilesQuery,
  UpdatePayrollProfileInput,
} from "./payroll.schemas";

const DEMO_BOUNDARY = "Portfolio demo only — not statutory payroll, tax, EPF, ESI, TDS, or filing advice.";

const profileConflict = () => new AppError(
  "An employee profile already uses this employee code or linked user in the store.", 409, "PAYROLL_PROFILE_CONFLICT"
);
const compensationOverlap = () => new AppError(
  "The effective range overlaps an existing compensation version.", 422, "COMPENSATION_VERSION_OVERLAP"
);

const isPgCode = (cause: unknown, code: string) =>
  typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;

type SafeProfile = Awaited<ReturnType<PayrollRepository["findProfile"]>>;

export class PayrollService {
  constructor(
    private readonly repository: PayrollRepository = payrollRepository,
    private readonly sensitiveData: SensitiveDataProtector = payrollSensitiveData,
  ) {}

  async listProfiles(actor: AuthPrincipal, query: PayrollProfilesQuery) {
    await this.authorize(actor, query.storeId, "payroll.read");
    const result = await this.repository.listProfiles(query);
    return { ...result, items: result.items.map((profile) => this.profileDto(profile)), policy: this.policy() };
  }

  async getProfile(actor: AuthPrincipal, id: number) {
    const identity = await this.repository.findProfileIdentity(id);
    if (!identity) throw resourceNotFound();
    await this.authorizeResource(actor, identity.storeId, "payroll.read");
    const profile = await this.repository.findProfile(id);
    if (!profile) throw resourceNotFound();
    return { data: this.profileDto(profile), policy: this.policy() };
  }

  async createProfile(actor: AuthPrincipal, input: CreatePayrollProfileInput) {
    await this.authorize(actor, input.storeId, "payroll.manage");
    if (!await this.repository.findStore(input.storeId)) throw resourceNotFound();
    if (input.userId && !await this.repository.findUser(input.userId)) throw resourceNotFound();
    const bank = input.bankAccountNumber ? this.sensitiveData.protect(input.bankAccountNumber) : null;
    const tax = input.taxIdentifier ? this.sensitiveData.protect(input.taxIdentifier) : null;
    try {
      const created = await this.repository.transaction(async (tx) => {
        await this.authorizeResource(actor, input.storeId, "payroll.manage", tx);
        const profile = await this.repository.createProfile(tx, input, {
          bankAccountEncrypted: bank?.encrypted ?? null,
          bankAccountLast4: bank?.last4 ?? null,
          taxIdentifierEncrypted: tax?.encrypted ?? null,
          taxIdentifierLast4: tax?.last4 ?? null,
        }, actor.userId);
        await auditService.write({
          tx, actor, storeId: input.storeId,
          action: "payroll.profile_created", resourceType: "employee_finance_profile", resourceId: profile.id,
          after: this.profileAuditState(profile),
        });
        return profile;
      });
      return { data: this.profileDto(created), policy: this.policy() };
    } catch (cause) {
      if (isPgCode(cause, "23505")) throw profileConflict();
      throw cause;
    }
  }

  async updateProfile(actor: AuthPrincipal, id: number, input: UpdatePayrollProfileInput) {
    const identity = await this.repository.findProfileIdentity(id);
    if (!identity) throw resourceNotFound();
    await this.authorizeResource(actor, identity.storeId, "payroll.manage");
    if (input.userId && !await this.repository.findUser(input.userId)) throw resourceNotFound();
    try {
      const updated = await this.repository.transaction(async (tx) => {
        const current = await this.repository.lockProfile(tx, id);
        if (!current) throw resourceNotFound();
        await this.authorizeResource(actor, current.storeId, "payroll.manage", tx);
        const employmentStartDate = input.employmentStartDate ?? current.employmentStartDate;
        const employmentEndDate = input.employmentEndDate === undefined ? current.employmentEndDate : input.employmentEndDate;
        const status = input.status ?? current.status;
        this.validateEmployment(employmentStartDate, employmentEndDate, status);

        const values: Partial<typeof current> = {
          ...(input.userId !== undefined ? { userId: input.userId } : {}),
          ...(input.employeeCode !== undefined ? { employeeCode: input.employeeCode } : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.employmentStartDate !== undefined ? { employmentStartDate: input.employmentStartDate } : {}),
          ...(input.employmentEndDate !== undefined ? { employmentEndDate: input.employmentEndDate } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.payFrequency !== undefined ? { payFrequency: input.payFrequency } : {}),
          updatedBy: actor.userId,
        };
        if (input.bankAccountNumber !== undefined) {
          const protectedValue = input.bankAccountNumber ? this.sensitiveData.protect(input.bankAccountNumber) : null;
          values.bankAccountEncrypted = protectedValue?.encrypted ?? null;
          values.bankAccountLast4 = protectedValue?.last4 ?? null;
        }
        if (input.taxIdentifier !== undefined) {
          const protectedValue = input.taxIdentifier ? this.sensitiveData.protect(input.taxIdentifier) : null;
          values.taxIdentifierEncrypted = protectedValue?.encrypted ?? null;
          values.taxIdentifierLast4 = protectedValue?.last4 ?? null;
        }
        const profile = await this.repository.updateProfile(tx, id, values);
        await auditService.write({
          tx, actor, storeId: current.storeId,
          action: "payroll.profile_updated", resourceType: "employee_finance_profile", resourceId: id,
          before: this.profileAuditState(current), after: this.profileAuditState(profile),
        });
        return profile;
      });
      return { data: this.profileDto(updated), policy: this.policy() };
    } catch (cause) {
      if (isPgCode(cause, "23505")) throw profileConflict();
      throw cause;
    }
  }

  async listCompensation(actor: AuthPrincipal, profileId: number, query: CompensationVersionsQuery) {
    const identity = await this.repository.findProfileIdentity(profileId);
    if (!identity) throw resourceNotFound();
    await this.authorizeResource(actor, identity.storeId, "payroll.read");
    const versions = await this.repository.listCompensationVersions(profileId, query);
    return { data: versions.map((item) => this.compensationDto(item)), policy: this.policy() };
  }

  async createCompensation(actor: AuthPrincipal, profileId: number, input: CreateCompensationVersionInput) {
    const identity = await this.repository.findProfileIdentity(profileId);
    if (!identity) throw resourceNotFound();
    await this.authorizeResource(actor, identity.storeId, "payroll.manage");
    this.compensationTotals(input.components);
    try {
      const created = await this.repository.transaction(async (tx) => {
        const profile = await this.repository.lockProfile(tx, profileId);
        if (!profile) throw resourceNotFound();
        await this.authorizeResource(actor, profile.storeId, "payroll.manage", tx);
        if (await this.repository.findCompensationOverlap(tx, profileId, input.effectiveFrom, input.effectiveTo)) {
          throw compensationOverlap();
        }
        const result = await this.repository.createCompensationVersion(tx, profileId, profile.storeId, input, actor.userId);
        await auditService.write({
          tx, actor, storeId: profile.storeId,
          action: "payroll.compensation_version_created", resourceType: "compensation_version", resourceId: result.version.id,
          after: { profileId, effectiveFrom: result.version.effectiveFrom, effectiveTo: result.version.effectiveTo, currency: "INR", demoOnly: true },
        });
        return result;
      });
      return { data: this.compensationDto(created), policy: this.policy() };
    } catch (cause) {
      if (isPgCode(cause, "23P01") || isPgCode(cause, "23505")) throw compensationOverlap();
      throw cause;
    }
  }

  private async authorize(actor: AuthPrincipal, storeId: number, permission: "payroll.read" | "payroll.manage") {
    await authorizationService.requireStorePermission({ principal: actor, storeId, permission });
  }

  private async authorizeResource(actor: AuthPrincipal, storeId: number, permission: "payroll.read" | "payroll.manage", tx?: TransactionType) {
    await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: storeId, permission, tx });
  }

  private profileDto(profile: NonNullable<SafeProfile>) {
    return {
      id: profile.id, storeId: profile.storeId, userId: profile.userId,
      employeeCode: profile.employeeCode, displayName: profile.displayName,
      employmentStartDate: profile.employmentStartDate, employmentEndDate: profile.employmentEndDate,
      status: profile.status, payFrequency: profile.payFrequency,
      bankAccountMasked: maskSensitiveLast4(profile.bankAccountLast4),
      taxIdentifierMasked: maskSensitiveLast4(profile.taxIdentifierLast4),
      createdAt: profile.createdAt, updatedAt: profile.updatedAt,
    };
  }

  private profileAuditState(profile: { userId: number | null; employeeCode: string; displayName: string; employmentStartDate: string; employmentEndDate: string | null; status: string; payFrequency: string }) {
    return {
      userId: profile.userId, employeeCode: profile.employeeCode, displayName: profile.displayName,
      employmentStartDate: profile.employmentStartDate, employmentEndDate: profile.employmentEndDate,
      status: profile.status, payFrequency: profile.payFrequency,
    };
  }

  private compensationDto(item: Awaited<ReturnType<PayrollRepository["createCompensationVersion"]>>) {
    return { ...item.version, components: item.components, totals: this.compensationTotals(item.components) };
  }

  private compensationTotals(components: Array<{ type: "earning" | "deduction" | "employer_cost"; amountPaise: number }>) {
    try {
      const sum = (type: "earning" | "deduction" | "employer_cost") => addPaise(
        components.filter((item) => item.type === type).map((item) => item.amountPaise),
        MONEY_CAPS.PAY_RUN_AMOUNT,
        `Recurring ${type} total`,
      );
      const grossPayPaise = sum("earning");
      const deductionPaise = sum("deduction");
      const employerCostPaise = sum("employer_cost");
      if (deductionPaise > grossPayPaise) {
        throw new AppError("Recurring deductions cannot exceed earnings.", 422, "COMPENSATION_DEDUCTIONS_EXCEED_EARNINGS");
      }
      return {
        grossPayPaise,
        deductionPaise,
        netPayPaise: subtractPaise(grossPayPaise, deductionPaise, { domainCap: MONEY_CAPS.PAY_RUN_AMOUNT }),
        employerCostPaise,
        totalEmployerCostPaise: addPaise([grossPayPaise, employerCostPaise], MONEY_CAPS.PAY_RUN_AMOUNT, "Total employer cost"),
      };
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      if (cause instanceof RangeError) throw new AppError(cause.message, 422, "COMPENSATION_TOTAL_OUT_OF_RANGE");
      throw cause;
    }
  }

  private validateEmployment(start: string, end: string | null, status: string) {
    if (end && end < start) throw new AppError("Employment end date cannot precede the start date.", 422, "EMPLOYMENT_DATE_INVALID");
    if (status === "terminated" && !end) throw new AppError("A terminated profile requires an employment end date.", 422, "EMPLOYMENT_END_DATE_REQUIRED");
  }

  private policy() { return { currency: "INR", payFrequency: "monthly", demoOnly: true, boundary: DEMO_BOUNDARY }; }
}

export default new PayrollService();
