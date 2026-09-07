export type PayRunStatus = "draft" | "calculated" | "approved" | "paid" | "posted" | "voided" | "reversed";
export type ComponentType = "earning" | "deduction" | "employer_cost";
export interface PageMeta { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; }
export interface PayrollPolicy { currency: "INR"; demoOnly: true; boundary: string; }
export interface PayrollProfile { id: number; storeId: number; employeeCode: string; displayName: string; employmentStartDate: string; employmentEndDate: string | null; status: "active" | "on_leave" | "terminated"; payFrequency: "monthly"; bankAccountMasked: string | null; taxIdentifierMasked: string | null; }
export interface CompensationComponent { id: number; type: ComponentType; code: string; name: string; amountPaise: number; }
export interface CompensationVersion { id: number; effectiveFrom: string; effectiveTo: string | null; sourceNote: string | null; components: CompensationComponent[]; totals: PayTotals; }
export interface PayTotals { grossPayPaise: number; deductionPaise: number; netPayPaise: number; employerCostPaise: number; totalEmployerCostPaise: number; }
export interface PayRun extends Partial<PayTotals> { id: number; storeId: number; periodStart: string; periodEnd: string; status: PayRunStatus; currency: "INR"; demoOnly: true; employeeCount: number | null; version: number; paymentReference?: string | null; }
export interface PayRunLine { id?: number; type: ComponentType; componentCode: string; componentName: string; amountPaise: number; }
export interface PayRunEmployee extends PayTotals { id: number; employeeCode: string; displayName: string; compensationVersionId: number; lines: PayRunLine[]; }
export interface PayRunDetail { run: PayRun; employees: PayRunEmployee[]; }
export interface PayStatement { payRun: Pick<PayRun, "id" | "storeId" | "periodStart" | "periodEnd" | "status" | "currency">; employee: { id: number; employeeCode: string; displayName: string; compensationVersionId: number }; lines: PayRunLine[]; totals: PayTotals; }
