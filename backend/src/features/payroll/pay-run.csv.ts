import { escapeCsvField } from "../finance-reports/finance-report.csv";

const HEADINGS = [
  "pay_run_id", "store_id", "period_start", "period_end", "status", "currency", "demo_only",
  "employee_code", "employee_name", "line_type", "component_code", "component_name", "amount_paise",
  "employee_gross_pay_paise", "employee_deduction_paise", "employee_net_pay_paise",
  "employee_employer_cost_paise", "employee_total_employer_cost_paise",
] as const;

interface PayRunExportDetail {
  run: {
    id: number;
    storeId: number;
    periodStart: string;
    periodEnd: string;
    status: string;
    currency: string;
    demoOnly: boolean;
  };
  employees: Array<{
    employeeCode: string;
    displayName: string;
    grossPayPaise: number;
    deductionPaise: number;
    netPayPaise: number;
    employerCostPaise: number;
    totalEmployerCostPaise: number;
    lines: Array<{
      type: string;
      componentCode: string;
      componentName: string;
      amountPaise: number;
    }>;
  }>;
}

export const buildPayRunCsv = (detail: PayRunExportDetail) => {
  const rows = detail.employees.flatMap((employee) => employee.lines.map((line) => [
    detail.run.id,
    detail.run.storeId,
    detail.run.periodStart,
    detail.run.periodEnd,
    detail.run.status,
    detail.run.currency,
    detail.run.demoOnly,
    employee.employeeCode,
    employee.displayName,
    line.type,
    line.componentCode,
    line.componentName,
    line.amountPaise,
    employee.grossPayPaise,
    employee.deductionPaise,
    employee.netPayPaise,
    employee.employerCostPaise,
    employee.totalEmployerCostPaise,
  ]));
  return [HEADINGS, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
};

export const payRunExportFilename = (run: PayRunExportDetail["run"]) =>
  `payroll-run-${run.id}-store-${run.storeId}-${run.periodStart}-${run.periodEnd}.csv`;
