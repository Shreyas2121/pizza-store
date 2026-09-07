import { createHash } from "node:crypto";
import type { PayRunStatus } from "../../db/schema";
import type { AuthPrincipal } from "../auth/auth.types";
import { AppError } from "../../utils/error";
import { addPaise, MONEY_CAPS, subtractPaise } from "../../utils/money";

const RECENT_AUTH_MS = 15 * 60_000;
const typeOrder = { earning: 0, deduction: 1, employer_cost: 2 } as const;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
};

export const hashPayRunPayload = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");

export const requirePayRunStatus = (actual: PayRunStatus, allowed: PayRunStatus[]) => {
  if (!allowed.includes(actual)) {
    throw new AppError(`Pay run cannot transition from ${actual}.`, 409, "PAY_RUN_INVALID_STATE", { actual, allowed });
  }
};

export const requireRecentPayrollAuthentication = (actor: AuthPrincipal, now = new Date()) => {
  if (!actor.authenticatedAt || now.getTime() - actor.authenticatedAt.getTime() > RECENT_AUTH_MS || actor.authenticatedAt.getTime() > now.getTime() + 60_000) {
    throw new AppError("Recent authentication is required for this payroll action.", 401, "RECENT_AUTHENTICATION_REQUIRED");
  }
};

export const requireIndependentApprover = (actorId: number, run: { createdBy: number | null; calculatedBy: number | null }) => {
  if (actorId === run.createdBy || actorId === run.calculatedBy) {
    throw new AppError("The pay-run drafter or calculator cannot approve it.", 403, "PAY_RUN_SEGREGATION_VIOLATION");
  }
};

export const requireIndependentPayer = (actorId: number, run: { createdBy: number | null; calculatedBy: number | null; approvedBy: number | null }) => {
  if (actorId === run.createdBy || actorId === run.calculatedBy || actorId === run.approvedBy) {
    throw new AppError("The pay-run drafter, calculator, or approver cannot pay it.", 403, "PAY_RUN_SEGREGATION_VIOLATION");
  }
};

export interface PayRunCalculationInput {
  profileId: number;
  compensationVersionId: number;
  employeeCode: string;
  displayName: string;
  components: Array<{
    id: number;
    type: "earning" | "deduction" | "employer_cost";
    code: string;
    name: string;
    amountPaise: number;
  }>;
}

export const calculatePayRunSnapshot = (input: PayRunCalculationInput[]) => {
  if (!input.length) throw new AppError("No employees are eligible for this pay period.", 422, "PAY_RUN_NO_ELIGIBLE_EMPLOYEES");
  try {
    const employees = [...input].sort((a, b) => a.profileId - b.profileId).map((employee) => {
      const lines = [...employee.components].sort((a, b) =>
        typeOrder[a.type] - typeOrder[b.type] || a.code.localeCompare(b.code) || a.id - b.id
      ).map((component) => ({
        compensationComponentId: component.id,
        type: component.type,
        componentCode: component.code,
        componentName: component.name,
        amountPaise: component.amountPaise,
      }));
      const sum = (type: keyof typeof typeOrder) => addPaise(
        lines.filter((line) => line.type === type).map((line) => line.amountPaise),
        MONEY_CAPS.PAY_RUN_AMOUNT,
        `${type} total`,
      );
      const grossPayPaise = sum("earning");
      const deductionPaise = sum("deduction");
      const employerCostPaise = sum("employer_cost");
      if (deductionPaise > grossPayPaise) {
        throw new AppError("Recurring deductions cannot exceed earnings.", 422, "COMPENSATION_DEDUCTIONS_EXCEED_EARNINGS");
      }
      return {
        profileId: employee.profileId,
        compensationVersionId: employee.compensationVersionId,
        employeeCode: employee.employeeCode,
        displayName: employee.displayName,
        grossPayPaise,
        deductionPaise,
        netPayPaise: subtractPaise(grossPayPaise, deductionPaise, { domainCap: MONEY_CAPS.PAY_RUN_AMOUNT }),
        employerCostPaise,
        totalEmployerCostPaise: addPaise([grossPayPaise, employerCostPaise], MONEY_CAPS.PAY_RUN_AMOUNT, "Employee employer cost"),
        lines,
      };
    });
    const runSum = (field: "grossPayPaise" | "deductionPaise" | "netPayPaise" | "employerCostPaise" | "totalEmployerCostPaise") =>
      addPaise(employees.map((employee) => employee[field]), MONEY_CAPS.PAY_RUN_AMOUNT, `Pay run ${field}`);
    return {
      employees,
      totals: {
        employeeCount: employees.length,
        grossPayPaise: runSum("grossPayPaise"),
        deductionPaise: runSum("deductionPaise"),
        netPayPaise: runSum("netPayPaise"),
        employerCostPaise: runSum("employerCostPaise"),
        totalEmployerCostPaise: runSum("totalEmployerCostPaise"),
      },
    };
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    if (cause instanceof RangeError) throw new AppError(cause.message, 422, "PAY_RUN_TOTAL_OUT_OF_RANGE");
    throw cause;
  }
};
