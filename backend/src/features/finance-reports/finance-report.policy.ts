import type { ReportTotalsDto } from "./finance-report.schemas";

export type FinanceMovement = {
  businessDate: string;
  accountCode: string;
  accountName: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense" | "contra_revenue";
  debitPaise: string;
  creditPaise: string;
};

export type ReportGroup = "month" | "quarter" | "fiscal_year";

const netDebit = (row: FinanceMovement) => BigInt(row.debitPaise) - BigInt(row.creditPaise);
const netCredit = (row: FinanceMovement) => BigInt(row.creditPaise) - BigInt(row.debitPaise);
const marginBps = (profit: bigint, revenue: bigint) => revenue === 0n ? null : Number((profit * 10_000n) / revenue);

export const comparisonPeriodFor = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const comparisonTo = new Date(start.getTime() - 86_400_000);
  const comparisonFrom = new Date(comparisonTo.getTime() - (days - 1) * 86_400_000);
  return { from: comparisonFrom.toISOString().slice(0, 10), to: comparisonTo.toISOString().slice(0, 10) };
};

export const reportPeriodKey = (businessDate: string, groupBy: ReportGroup) => {
  const [year, month] = businessDate.split("-").map(Number);
  if (groupBy === "month") return `${year}-${String(month).padStart(2, "0")}`;
  if (groupBy === "quarter") return `${year}-Q${Math.ceil(month / 3)}`;
  const startYear = month >= 4 ? year : year - 1;
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
};

export const projectFinanceReport = (
  rows: FinanceMovement[],
  options: { collectionsPaise?: string; unsettledRazorpayPaise?: string } = {}
) => {
  let sales = 0n;
  let delivery = 0n;
  let discounts = 0n;
  let refunds = 0n;
  let cogs = 0n;
  let payroll = 0n;
  let operatingExpenses = 0n;
  let cashVariance = 0n;
  const expenseLines = new Map<string, { accountCode: string; accountName: string; amountPaise: bigint }>();

  for (const row of rows) {
    const debit = netDebit(row);
    if (row.accountCode === "4000") sales += netCredit(row);
    else if (row.accountCode === "4010") delivery += netCredit(row);
    else if (row.accountCode === "4100") discounts += debit;
    else if (row.accountCode === "4110") refunds += debit;
    else if (row.accountCode === "5000") cogs += debit;
    else if (row.accountCode === "6200") payroll += debit;
    else if (row.accountType === "expense") {
      operatingExpenses += debit;
      const current = expenseLines.get(row.accountCode);
      expenseLines.set(row.accountCode, { accountCode: row.accountCode, accountName: row.accountName, amountPaise: (current?.amountPaise ?? 0n) + debit });
    }
    if (row.accountCode === "6100") cashVariance += debit;
  }

  const recognizedRevenue = sales + delivery - discounts - refunds;
  const grossProfit = recognizedRevenue - cogs;
  const operatingResult = grossProfit - operatingExpenses - payroll;
  const totals: ReportTotalsDto = {
    salesRevenuePaise: sales.toString(), deliveryRevenuePaise: delivery.toString(), discountsPaise: discounts.toString(), refundsPaise: refunds.toString(),
    recognizedRevenuePaise: recognizedRevenue.toString(), collectionsPaise: options.collectionsPaise ?? "0", cogsPaise: cogs.toString(),
    grossProfitPaise: grossProfit.toString(), grossMarginBps: marginBps(grossProfit, recognizedRevenue), operatingExpensesPaise: operatingExpenses.toString(),
    payrollCostPaise: payroll.toString(), operatingResultPaise: operatingResult.toString(), unsettledRazorpayPaise: options.unsettledRazorpayPaise ?? "0", cashVariancePaise: cashVariance.toString(),
  };
  return { totals, operatingExpenseLines: [...expenseLines.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode)).map((line) => ({ ...line, amountPaise: line.amountPaise.toString() })) };
};

export const groupFinanceReport = (rows: FinanceMovement[], groupBy: ReportGroup) => {
  const groups = new Map<string, FinanceMovement[]>();
  for (const row of rows) {
    const key = reportPeriodKey(row.businessDate, groupBy);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([period, periodRows]) => ({ period, ...projectFinanceReport(periodRows).totals }));
};
