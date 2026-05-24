import type {
  Alert,
  APAgingBucket,
  ARAgingBucket,
  Bill,
  BudgetVsActual,
  CashForecastMonth,
  CashForecastWeek,
  ExpenseCategory,
  ForecastAssumption,
  Integration,
  Invoice,
  Job,
  KPI,
  MonthlyTrend,
  Opportunity,
  Organization,
  PlatformTenant,
  Report,
  RevenueSource,
  Scenario,
  TeamMember,
  TenantData,
  Transaction,
  User,
  FinancialSnapshot,
} from "@/lib/types";

export const ORGANIZATIONS: Organization[] = [
  {
    id: "org-apex",
    name: "Apex Construction Group",
    slug: "apex-construction",
    industry: "Commercial Construction",
    plan: "growth",
    createdAt: "2023-06-15",
    settings: {
      cashAlertThreshold: 150000,
      forecastHorizonWeeks: 13,
      fiscalYearStart: 1,
      currency: "USD",
    },
  },
  {
    id: "org-summit",
    name: "Summit Renovations LLC",
    slug: "summit-renovations",
    industry: "Residential Renovation",
    plan: "starter",
    createdAt: "2024-01-10",
    settings: {
      cashAlertThreshold: 75000,
      forecastHorizonWeeks: 13,
      fiscalYearStart: 1,
      currency: "USD",
    },
  },
];

export const CURRENT_USER: User = {
  id: "user-1",
  email: "sarah.chen@apexconstruction.com",
  name: "Sarah Chen",
  role: "founder",
  organizationId: "org-apex",
  lastActiveAt: new Date().toISOString(),
};

export const FINANCIAL_SNAPSHOT: FinancialSnapshot = {
  currentCash: 487250,
  forecastedCash: 412800,
  revenueMTD: 892400,
  revenueYTD: 6840000,
  grossProfit: 2456800,
  netProfit: 892400,
  operatingExpenses: 1564400,
  accountsReceivable: 1245800,
  accountsPayable: 687300,
  burnRate: 142000,
  runway: 3.4,
  debtObligations: 450000,
  payrollObligations: 186400,
  ebitda: 1125600,
};

export const MONTHLY_TRENDS: MonthlyTrend[] = [
  { month: "Jan", revenue: 520000, expenses: 412000, profit: 108000, cash: 380000 },
  { month: "Feb", revenue: 480000, expenses: 398000, profit: 82000, cash: 395000 },
  { month: "Mar", revenue: 610000, expenses: 445000, profit: 165000, cash: 420000 },
  { month: "Apr", revenue: 580000, expenses: 432000, profit: 148000, cash: 445000 },
  { month: "May", revenue: 720000, expenses: 478000, profit: 242000, cash: 462000 },
  { month: "Jun", revenue: 680000, expenses: 465000, profit: 215000, cash: 478000 },
  { month: "Jul", revenue: 750000, expenses: 492000, profit: 258000, cash: 485000 },
  { month: "Aug", revenue: 710000, expenses: 488000, profit: 222000, cash: 487250 },
  { month: "Sep", revenue: 892400, expenses: 512000, profit: 380400, cash: 487250 },
  { month: "Oct", revenue: 0, expenses: 0, profit: 0, cash: 0 },
  { month: "Nov", revenue: 0, expenses: 0, profit: 0, cash: 0 },
  { month: "Dec", revenue: 0, expenses: 0, profit: 0, cash: 0 },
];

export const BUDGET_VS_ACTUAL: BudgetVsActual[] = [
  { category: "Revenue", budget: 850000, actual: 892400, variance: 42400, variancePercent: 5.0 },
  { category: "Labor", budget: 320000, actual: 298400, variance: 21600, variancePercent: 6.8 },
  { category: "Materials", budget: 245000, actual: 268200, variance: -23200, variancePercent: -9.5 },
  { category: "Subcontractors", budget: 180000, actual: 172800, variance: 7200, variancePercent: 4.0 },
  { category: "Operating Expenses", budget: 95000, actual: 98400, variance: -3400, variancePercent: -3.6 },
  { category: "Payroll", budget: 186000, actual: 186400, variance: -400, variancePercent: -0.2 },
];

export const FORECAST_ASSUMPTIONS: ForecastAssumption[] = [
  { id: "fa-1", category: "Receivables Collection", type: "inflow", amount: 285000, frequency: "weekly", startDate: "2025-05-26" },
  { id: "fa-2", category: "New Sales Revenue", type: "inflow", amount: 175000, frequency: "weekly", startDate: "2025-05-26" },
  { id: "fa-3", category: "Recurring Service Revenue", type: "inflow", amount: 42000, frequency: "monthly", startDate: "2025-05-26" },
  { id: "fa-4", category: "Payroll", type: "outflow", amount: 186400, frequency: "monthly", startDate: "2025-05-26" },
  { id: "fa-5", category: "Rent & Facilities", type: "outflow", amount: 18500, frequency: "monthly", startDate: "2025-05-26" },
  { id: "fa-6", category: "Subcontractors", type: "outflow", amount: 95000, frequency: "weekly", startDate: "2025-05-26" },
  { id: "fa-7", category: "Materials", type: "outflow", amount: 72000, frequency: "weekly", startDate: "2025-05-26" },
  { id: "fa-8", category: "Loan Payment", type: "outflow", amount: 12500, frequency: "monthly", startDate: "2025-05-26" },
  { id: "fa-9", category: "Equipment Purchase", type: "outflow", amount: 85000, frequency: "one_time", startDate: "2025-07-15", notes: "New excavator deposit" },
];

export const CASH_FORECAST_WEEKS: CashForecastWeek[] = [
  { week: 1, weekStart: "2025-05-26", weekEnd: "2025-06-01", startingBalance: 487250, inflows: 312000, outflows: 298400, endingBalance: 500850, isRiskPeriod: false },
  { week: 2, weekStart: "2025-06-02", weekEnd: "2025-06-08", startingBalance: 500850, inflows: 285000, outflows: 312000, endingBalance: 473850, isRiskPeriod: false },
  { week: 3, weekStart: "2025-06-09", weekEnd: "2025-06-15", startingBalance: 473850, inflows: 298000, outflows: 325000, endingBalance: 446850, isRiskPeriod: false },
  { week: 4, weekStart: "2025-06-16", weekEnd: "2025-06-22", startingBalance: 446850, inflows: 275000, outflows: 342000, endingBalance: 379850, isRiskPeriod: false },
  { week: 5, weekStart: "2025-06-23", weekEnd: "2025-06-29", startingBalance: 379850, inflows: 320000, outflows: 298000, endingBalance: 401850, isRiskPeriod: false },
  { week: 6, weekStart: "2025-06-30", weekEnd: "2025-07-06", startingBalance: 401850, inflows: 265000, outflows: 386400, endingBalance: 280450, isRiskPeriod: false },
  { week: 7, weekStart: "2025-07-07", weekEnd: "2025-07-13", startingBalance: 280450, inflows: 310000, outflows: 295000, endingBalance: 295450, isRiskPeriod: false },
  { week: 8, weekStart: "2025-07-14", weekEnd: "2025-07-20", startingBalance: 295450, inflows: 245000, outflows: 380000, endingBalance: 160450, isRiskPeriod: false },
  { week: 9, weekStart: "2025-07-21", weekEnd: "2025-07-27", startingBalance: 160450, inflows: 335000, outflows: 288000, endingBalance: 207450, isRiskPeriod: false },
  { week: 10, weekStart: "2025-07-28", weekEnd: "2025-08-03", startingBalance: 207450, inflows: 298000, outflows: 302000, endingBalance: 203450, isRiskPeriod: false },
  { week: 11, weekStart: "2025-08-04", weekEnd: "2025-08-10", startingBalance: 203450, inflows: 275000, outflows: 315000, endingBalance: 163450, isRiskPeriod: false },
  { week: 12, weekStart: "2025-08-11", weekEnd: "2025-08-17", startingBalance: 163450, inflows: 342000, outflows: 298000, endingBalance: 207450, isRiskPeriod: false },
  { week: 13, weekStart: "2025-08-18", weekEnd: "2025-08-24", startingBalance: 207450, inflows: 310000, outflows: 305000, endingBalance: 212450, isRiskPeriod: false },
];

export const CASH_FORECAST_MONTHS: CashForecastMonth[] = [
  { month: "Jun 2025", inflows: 1190000, outflows: 1273400, endingBalance: 401850, isRiskPeriod: false },
  { month: "Jul 2025", inflows: 1100000, outflows: 1359400, endingBalance: 142506, isRiskPeriod: true },
  { month: "Aug 2025", inflows: 1225000, outflows: 1210000, endingBalance: 157506, isRiskPeriod: false },
  { month: "Sep 2025", inflows: 1350000, outflows: 1180000, endingBalance: 327506, isRiskPeriod: false },
  { month: "Oct 2025", inflows: 1280000, outflows: 1220000, endingBalance: 387506, isRiskPeriod: false },
  { month: "Nov 2025", inflows: 1150000, outflows: 1250000, endingBalance: 287506, isRiskPeriod: false },
];

export const SCENARIOS: Scenario[] = [
  { id: "sc-base", name: "Base Case", type: "base", revenueGrowthRate: 8, collectionTimingDays: 45, expenseIncreaseRate: 3, endingCash: 212450, minimumCash: 160450, runway: 3.4, description: "Current trajectory with moderate growth" },
  { id: "sc-best", name: "Best Case", type: "best", revenueGrowthRate: 18, collectionTimingDays: 35, expenseIncreaseRate: 2, endingCash: 385200, minimumCash: 298400, runway: 5.8, description: "Strong sales, faster collections, controlled costs" },
  { id: "sc-worst", name: "Worst Case", type: "worst", revenueGrowthRate: -5, collectionTimingDays: 60, expenseIncreaseRate: 8, endingCash: 45200, minimumCash: 28400, runway: 0.8, description: "Delayed projects, slow AR, rising material costs" },
  { id: "sc-growth", name: "Growth Case", type: "growth", revenueGrowthRate: 25, collectionTimingDays: 40, expenseIncreaseRate: 12, endingCash: 298600, minimumCash: 125000, runway: 4.2, description: "Aggressive expansion with new crew hires" },
  { id: "sc-downside", name: "Downside Case", type: "downside", revenueGrowthRate: 0, collectionTimingDays: 55, expenseIncreaseRate: 6, endingCash: 98400, minimumCash: 52000, runway: 1.6, description: "Flat revenue with cost pressure" },
];

export const OPPORTUNITIES: Opportunity[] = [
  { id: "opp-1", name: "Riverside Office Complex", customer: "Meridian Properties", stage: "negotiation", probability: 75, value: 2400000, expectedCloseDate: "2025-06-30", rep: "Mike Torres", source: "Referral", weightedValue: 1800000 },
  { id: "opp-2", name: "Downtown Retail Fit-Out", customer: "Urban Retail Group", stage: "proposal", probability: 50, value: 680000, expectedCloseDate: "2025-07-15", rep: "Lisa Park", source: "HubSpot", weightedValue: 340000 },
  { id: "opp-3", name: "Warehouse Expansion", customer: "LogiCore Inc", stage: "qualified", probability: 40, value: 1200000, expectedCloseDate: "2025-08-01", rep: "Mike Torres", source: "Website", weightedValue: 480000 },
  { id: "opp-4", name: "School Renovation Phase 2", customer: "Oak Valley School District", stage: "proposal", probability: 65, value: 890000, expectedCloseDate: "2025-06-20", rep: "James Wilson", source: "Existing Client", weightedValue: 578500 },
  { id: "opp-5", name: "Medical Center Build-Out", customer: "HealthFirst Partners", stage: "lead", probability: 20, value: 3500000, expectedCloseDate: "2025-09-30", rep: "Lisa Park", source: "Trade Show", weightedValue: 700000 },
  { id: "opp-6", name: "Restaurant Chain Rollout", customer: "Coastal Dining Co", stage: "negotiation", probability: 80, value: 520000, expectedCloseDate: "2025-06-10", rep: "James Wilson", source: "Referral", weightedValue: 416000 },
  { id: "opp-7", name: "Apartment Complex Phase 3", customer: "Harbor Living LLC", stage: "closed_won", probability: 100, value: 1850000, expectedCloseDate: "2025-05-15", rep: "Mike Torres", source: "Existing Client", weightedValue: 1850000 },
];

export const JOBS: Job[] = [
  { id: "job-1", name: "Harbor View Apartments - Phase 2", customer: "Harbor Living LLC", status: "active", contractValue: 1850000, estimatedGrossMargin: 28, actualGrossMargin: 26.5, laborCost: 420000, materialCost: 580000, subcontractorCost: 245000, completionPercent: 62, expectedBillingDate: "2025-06-15", expectedCollectionDate: "2025-07-15", projectManager: "Tom Bradley" },
  { id: "job-2", name: "Tech Park Building C", customer: "Innovate Campus LLC", status: "active", contractValue: 980000, estimatedGrossMargin: 32, actualGrossMargin: 30.2, laborCost: 245000, materialCost: 312000, subcontractorCost: 98000, completionPercent: 45, expectedBillingDate: "2025-06-30", expectedCollectionDate: "2025-07-30", projectManager: "Amy Foster" },
  { id: "job-3", name: "City Library Renovation", customer: "Oak Valley School District", status: "active", contractValue: 720000, estimatedGrossMargin: 25, actualGrossMargin: 22.8, laborCost: 198000, materialCost: 245000, subcontractorCost: 86000, completionPercent: 78, expectedBillingDate: "2025-05-28", expectedCollectionDate: "2025-06-28", projectManager: "Tom Bradley" },
  { id: "job-4", name: "Industrial Park Warehouse", customer: "LogiCore Inc", status: "planning", contractValue: 1450000, estimatedGrossMargin: 30, actualGrossMargin: 0, laborCost: 0, materialCost: 45000, subcontractorCost: 12000, completionPercent: 5, expectedBillingDate: "2025-08-15", expectedCollectionDate: "2025-09-15", projectManager: "Amy Foster" },
  { id: "job-5", name: "Boutique Hotel Lobby", customer: "Coastal Hospitality", status: "active", contractValue: 385000, estimatedGrossMargin: 35, actualGrossMargin: 18.2, laborCost: 98000, materialCost: 142000, subcontractorCost: 45000, completionPercent: 55, expectedBillingDate: "2025-06-20", expectedCollectionDate: "2025-07-20", projectManager: "Tom Bradley" },
  { id: "job-6", name: "Senior Living Facility", customer: "Golden Years Corp", status: "on_hold", contractValue: 2100000, estimatedGrossMargin: 27, actualGrossMargin: 24.1, laborCost: 312000, materialCost: 398000, subcontractorCost: 156000, completionPercent: 35, expectedBillingDate: "2025-09-01", expectedCollectionDate: "2025-10-01", projectManager: "Amy Foster" },
];

export const INVOICES: Invoice[] = [
  { id: "inv-1", number: "INV-2025-0847", customer: "Harbor Living LLC", amount: 285000, dueDate: "2025-05-15", status: "overdue", daysOutstanding: 9 },
  { id: "inv-2", number: "INV-2025-0851", customer: "Innovate Campus LLC", amount: 142000, dueDate: "2025-05-28", status: "sent", daysOutstanding: 0 },
  { id: "inv-3", number: "INV-2025-0855", customer: "Oak Valley School District", amount: 98000, dueDate: "2025-06-05", status: "sent", daysOutstanding: 0 },
  { id: "inv-4", number: "INV-2025-0839", customer: "Coastal Hospitality", amount: 67500, dueDate: "2025-04-30", status: "overdue", daysOutstanding: 24 },
  { id: "inv-5", number: "INV-2025-0860", customer: "Meridian Properties", amount: 420000, dueDate: "2025-06-15", status: "sent", daysOutstanding: 0 },
  { id: "inv-6", number: "INV-2025-0822", customer: "Golden Years Corp", amount: 156000, dueDate: "2025-04-15", status: "overdue", daysOutstanding: 39 },
];

export const BILLS: Bill[] = [
  { id: "bill-1", vendor: "Steel Supply Co", amount: 86400, dueDate: "2025-06-01", status: "pending", category: "Materials" },
  { id: "bill-2", vendor: "Premier Electric LLC", amount: 42800, dueDate: "2025-06-05", status: "pending", category: "Subcontractors" },
  { id: "bill-3", vendor: "Office Lease - Main St", amount: 18500, dueDate: "2025-06-01", status: "pending", category: "Rent" },
  { id: "bill-4", vendor: "Gusto Payroll", amount: 186400, dueDate: "2025-05-30", status: "pending", category: "Payroll" },
  { id: "bill-5", vendor: "First National Bank", amount: 12500, dueDate: "2025-06-15", status: "pending", category: "Loan Payment" },
  { id: "bill-6", vendor: "Concrete Masters Inc", amount: 67200, dueDate: "2025-05-20", status: "overdue", category: "Materials" },
];

export const ALERTS: Alert[] = [
  { id: "alert-1", title: "Cash Below Threshold in Week 8", description: "Projected cash balance drops to $160,450 during week of Jul 14 due to equipment purchase and payroll cycle.", severity: "critical", recommendedAction: "Accelerate AR collections on INV-2025-0847 ($285K) and delay equipment deposit by 2 weeks.", affectedMetric: "Cash Balance", riskWindow: "Jul 14–20, 2025", owner: "Sarah Chen", isRead: false, createdAt: "2025-05-24T08:00:00Z" },
  { id: "alert-2", title: "AR Aging Risk — $519K Overdue", description: "Three invoices totaling $519K are past due, with Golden Years Corp invoice 39 days outstanding.", severity: "high", recommendedAction: "Escalate collection calls for INV-2025-0822. Consider lien rights on Senior Living project.", affectedMetric: "Accounts Receivable", dueDate: "2025-05-30", owner: "Mike Torres", isRead: false, createdAt: "2025-05-23T14:30:00Z" },
  { id: "alert-3", title: "Low Gross Margin on Boutique Hotel", description: "Job profitability at 18.2% vs 35% estimate due to material cost overruns and change orders.", severity: "high", recommendedAction: "Review change order billing. Renegotiate remaining subcontractor scope.", affectedMetric: "Gross Margin", owner: "Tom Bradley", isRead: true, createdAt: "2025-05-22T10:15:00Z" },
  { id: "alert-4", title: "Payroll Due in 6 Days", description: "Bi-weekly payroll of $186,400 due May 30. Current cash sufficient but reduces forecast buffer.", severity: "medium", recommendedAction: "Confirm payroll funding. Review overtime hours on active jobs.", affectedMetric: "Payroll", dueDate: "2025-05-30", owner: "Sarah Chen", isRead: true, createdAt: "2025-05-24T06:00:00Z" },
  { id: "alert-5", title: "Revenue Below Forecast", description: "May revenue tracking 4.2% below forecast due to delayed Harbor View billing milestone.", severity: "medium", recommendedAction: "Expedite progress billing on Harbor View Phase 2 (62% complete).", affectedMetric: "Revenue", owner: "Amy Foster", isRead: false, createdAt: "2025-05-21T16:45:00Z" },
  { id: "alert-6", title: "AP Pressure — Concrete Masters Overdue", description: "$67,200 materials bill 4 days overdue. Vendor threatening hold on future deliveries.", severity: "medium", recommendedAction: "Process payment immediately to maintain vendor relationship.", affectedMetric: "Accounts Payable", dueDate: "2025-05-24", owner: "Sarah Chen", isRead: false, createdAt: "2025-05-24T07:30:00Z" },
  { id: "alert-7", title: "Debt Coverage Concern", description: "Debt service coverage ratio projected at 1.2x in July, below 1.5x covenant threshold.", severity: "critical", recommendedAction: "Prepare lender communication. Model impact of delayed capex on coverage ratio.", affectedMetric: "Debt Service Coverage", riskWindow: "Jul 2025", owner: "Sarah Chen", isRead: false, createdAt: "2025-05-20T09:00:00Z" },
];

export const KPIS: KPI[] = [
  { id: "kpi-1", name: "Revenue Growth", value: 12.4, unit: "percent", change: 2.1, changeLabel: "vs last month", target: 10 },
  { id: "kpi-2", name: "Gross Margin", value: 35.9, unit: "percent", change: -1.2, changeLabel: "vs last month", target: 32 },
  { id: "kpi-3", name: "Net Margin", value: 13.0, unit: "percent", change: 0.8, changeLabel: "vs last month", target: 12 },
  { id: "kpi-4", name: "Cash Conversion Cycle", value: 42, unit: "days", change: -3, changeLabel: "vs last quarter", target: 45 },
  { id: "kpi-5", name: "AR Days", value: 48, unit: "days", change: 5, changeLabel: "vs last month", target: 40 },
  { id: "kpi-6", name: "AP Days", value: 32, unit: "days", change: -2, changeLabel: "vs last month", target: 35 },
  { id: "kpi-7", name: "Sales Close Rate", value: 34, unit: "percent", change: 4, changeLabel: "vs last quarter", target: 30 },
  { id: "kpi-8", name: "Average Deal Size", value: 1420000, unit: "currency", change: 8.5, changeLabel: "vs last quarter" },
  { id: "kpi-9", name: "Job Profitability", value: 26.8, unit: "percent", change: -2.4, changeLabel: "vs estimate", target: 28 },
  { id: "kpi-10", name: "Operating Expense Ratio", value: 22.9, unit: "percent", change: -0.5, changeLabel: "vs last month", target: 24 },
  { id: "kpi-11", name: "Debt Service Coverage", value: 1.8, unit: "number", change: -0.2, changeLabel: "vs last quarter", target: 1.5 },
  { id: "kpi-12", name: "Runway", value: 3.4, unit: "number", change: -0.3, changeLabel: "months", target: 6 },
  { id: "kpi-13", name: "EBITDA", value: 1125600, unit: "currency", change: 15.2, changeLabel: "vs last month" },
];

export const INTEGRATIONS: Integration[] = [
  { id: "int-1", name: "QuickBooks Online", category: "accounting", status: "connected", lastSync: "2025-05-24T06:00:00Z", description: "Sync transactions, invoices, bills, and chart of accounts", logo: "QB" },
  { id: "int-2", name: "Xero", category: "accounting", status: "disconnected", description: "Alternative accounting platform integration", logo: "XE" },
  { id: "int-3", name: "Stripe", category: "payments", status: "connected", lastSync: "2025-05-24T05:30:00Z", description: "Payment processing and revenue tracking", logo: "ST" },
  { id: "int-4", name: "Plaid", category: "payments", status: "connected", lastSync: "2025-05-24T06:15:00Z", description: "Bank account connections and cash balance sync", logo: "PL" },
  { id: "int-5", name: "Gusto", category: "payroll", status: "connected", lastSync: "2025-05-23T18:00:00Z", description: "Payroll, benefits, and contractor payments", logo: "GU" },
  { id: "int-6", name: "Buildertrend", category: "operations", status: "pending", description: "Job costing, scheduling, and production tracking", logo: "BT" },
  { id: "int-7", name: "HubSpot", category: "sales", status: "connected", lastSync: "2025-05-24T04:00:00Z", description: "CRM, deals pipeline, and sales forecasting", logo: "HS" },
  { id: "int-8", name: "Salesforce", category: "sales", status: "disconnected", description: "Enterprise CRM and opportunity management", logo: "SF" },
  { id: "int-9", name: "Jobber", category: "operations", status: "disconnected", description: "Field service and job management", logo: "JB" },
  { id: "int-10", name: "Google Sheets", category: "other", status: "connected", lastSync: "2025-05-24T03:00:00Z", description: "Import custom spreadsheets and forecasts", logo: "GS" },
];

export const REPORTS: Report[] = [
  { id: "rpt-1", name: "Executive Summary", description: "High-level financial overview for leadership and board review", category: "Executive", lastGenerated: "2025-05-24", format: ["pdf", "excel"] },
  { id: "rpt-2", name: "Cash Forecast Report", description: "13-week rolling cash forecast with scenario analysis", category: "Forecasting", lastGenerated: "2025-05-24", format: ["pdf", "excel"] },
  { id: "rpt-3", name: "Profit & Loss Summary", description: "Monthly and YTD P&L with variance analysis", category: "Financials", lastGenerated: "2025-05-23", format: ["pdf", "excel"] },
  { id: "rpt-4", name: "Balance Sheet Summary", description: "Assets, liabilities, and equity snapshot", category: "Financials", lastGenerated: "2025-05-23", format: ["pdf", "excel"] },
  { id: "rpt-5", name: "AR Aging Report", description: "Accounts receivable aging by customer and bucket", category: "Financials", lastGenerated: "2025-05-24", format: ["pdf", "excel"] },
  { id: "rpt-6", name: "AP Aging Report", description: "Accounts payable aging by vendor and due date", category: "Financials", lastGenerated: "2025-05-24", format: ["pdf", "excel"] },
  { id: "rpt-7", name: "Sales Pipeline Forecast", description: "Weighted pipeline revenue projection by stage and rep", category: "Sales", lastGenerated: "2025-05-22", format: ["pdf", "excel"] },
  { id: "rpt-8", name: "Job Profitability Report", description: "Margin analysis by active and completed jobs", category: "Operations", lastGenerated: "2025-05-21", format: ["pdf", "excel"] },
  { id: "rpt-9", name: "Budget vs Actual", description: "Category-level budget variance analysis", category: "Financials", lastGenerated: "2025-05-24", format: ["pdf", "excel"] },
  { id: "rpt-10", name: "Forecast vs Actual", description: "Forecast accuracy and variance tracking", category: "Forecasting", lastGenerated: "2025-05-24", format: ["pdf", "excel"] },
  { id: "rpt-11", name: "KPI Scorecard", description: "Key performance indicators dashboard export", category: "Executive", lastGenerated: "2025-05-24", format: ["pdf", "excel"] },
];

export const TEAM_MEMBERS: TeamMember[] = [
  { id: "tm-1", name: "Sarah Chen", email: "sarah.chen@apexconstruction.com", role: "founder", status: "active", joinedAt: "2023-06-15" },
  { id: "tm-2", name: "David Okonkwo", email: "david.okonkwo@apexconstruction.com", role: "cfo", status: "active", joinedAt: "2023-08-01" },
  { id: "tm-3", name: "Mike Torres", email: "mike.torres@apexconstruction.com", role: "sales", status: "active", joinedAt: "2023-09-15" },
  { id: "tm-4", name: "Amy Foster", email: "amy.foster@apexconstruction.com", role: "project_manager", status: "active", joinedAt: "2024-01-10" },
  { id: "tm-5", name: "Tom Bradley", email: "tom.bradley@apexconstruction.com", role: "project_manager", status: "active", joinedAt: "2024-03-01" },
  { id: "tm-6", name: "Lisa Park", email: "lisa.park@apexconstruction.com", role: "sales", status: "active", joinedAt: "2024-06-01" },
  { id: "tm-7", name: "James Wilson", email: "james.wilson@apexconstruction.com", role: "sales", status: "active", joinedAt: "2024-09-01" },
  { id: "tm-8", name: "Karen Mitchell", email: "karen.mitchell@apexconstruction.com", role: "operations", status: "active", joinedAt: "2024-02-15" },
  { id: "tm-9", name: "Robert Hayes", email: "robert.hayes@consulting.com", role: "advisor", status: "active", joinedAt: "2025-01-01" },
  { id: "tm-10", name: "New Controller", email: "controller@apexconstruction.com", role: "cfo", status: "invited", invitedAt: "2025-05-20" },
];

export const TRANSACTIONS: Transaction[] = [
  { id: "txn-1", date: "2025-05-22", description: "Harbor Living - Progress Payment", category: "Revenue", amount: 142000, type: "income" },
  { id: "txn-2", date: "2025-05-21", description: "Steel Supply Co - Materials", category: "Materials", amount: -86400, type: "expense" },
  { id: "txn-3", date: "2025-05-20", description: "Innovate Campus - Milestone 3", category: "Revenue", amount: 98000, type: "income" },
  { id: "txn-4", date: "2025-05-19", description: "Premier Electric - Subcontractor", category: "Subcontractors", amount: -42800, type: "expense" },
  { id: "txn-5", date: "2025-05-18", description: "Payroll - Bi-weekly", category: "Payroll", amount: -186400, type: "expense" },
  { id: "txn-6", date: "2025-05-17", description: "Coastal Hospitality - Deposit", category: "Revenue", amount: 38500, type: "income" },
  { id: "txn-7", date: "2025-05-16", description: "Equipment Rental", category: "Operating", amount: -12400, type: "expense" },
  { id: "txn-8", date: "2025-05-15", description: "Insurance Premium", category: "Operating", amount: -8900, type: "expense" },
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { category: "Labor", amount: 298400, percentOfRevenue: 33.4 },
  { category: "Materials", amount: 268200, percentOfRevenue: 30.0 },
  { category: "Subcontractors", amount: 172800, percentOfRevenue: 19.4 },
  { category: "Payroll (Admin)", amount: 98400, percentOfRevenue: 11.0 },
  { category: "Operating", amount: 54600, percentOfRevenue: 6.1 },
];

export const REVENUE_SOURCES: RevenueSource[] = [
  { source: "Commercial Construction", amount: 534400, percent: 59.9 },
  { source: "Renovation & Fit-Out", amount: 223100, percent: 25.0 },
  { source: "Service & Maintenance", amount: 89400, percent: 10.0 },
  { source: "Change Orders", amount: 45500, percent: 5.1 },
];

export const AR_AGING: ARAgingBucket[] = [
  { bucket: "Current", amount: 726800, count: 12 },
  { bucket: "1-30 Days", amount: 384500, count: 5 },
  { bucket: "31-60 Days", amount: 98500, count: 2 },
  { bucket: "61-90 Days", amount: 36000, count: 1 },
  { bucket: "90+ Days", amount: 0, count: 0 },
];

export const AP_AGING: APAgingBucket[] = [
  { bucket: "Current", amount: 412600, count: 8 },
  { bucket: "1-30 Days", amount: 198700, count: 4 },
  { bucket: "31-60 Days", amount: 67200, count: 1 },
  { bucket: "61-90 Days", amount: 8800, count: 1 },
  { bucket: "90+ Days", amount: 0, count: 0 },
];

export const PLATFORM_TENANTS: PlatformTenant[] = [
  { id: "org-apex", name: "Apex Construction Group", plan: "Growth", users: 10, mrr: 499, status: "active", createdAt: "2023-06-15" },
  { id: "org-summit", name: "Summit Renovations LLC", plan: "Starter", users: 3, mrr: 149, status: "active", createdAt: "2024-01-10" },
  { id: "org-buildright", name: "BuildRight Contractors", plan: "Enterprise", users: 25, mrr: 999, status: "active", createdAt: "2023-03-20" },
  { id: "org-greenfield", name: "Greenfield Development", plan: "Growth", users: 8, mrr: 499, status: "trial", createdAt: "2025-04-01" },
  { id: "org-legacy", name: "Legacy Builders Inc", plan: "Starter", users: 2, mrr: 0, status: "churned", createdAt: "2023-11-01" },
];

export function getTenantData(organizationId: string): TenantData {
  const organization = ORGANIZATIONS.find((o) => o.id === organizationId) ?? ORGANIZATIONS[0];
  return {
    organization,
    users: TEAM_MEMBERS.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      role: m.role,
      organizationId,
      lastActiveAt: new Date().toISOString(),
    })),
    financialSnapshot: FINANCIAL_SNAPSHOT,
    monthlyTrends: MONTHLY_TRENDS,
    budgetVsActual: BUDGET_VS_ACTUAL,
    forecastAssumptions: FORECAST_ASSUMPTIONS,
    cashForecastWeeks: CASH_FORECAST_WEEKS,
    cashForecastMonths: CASH_FORECAST_MONTHS,
    scenarios: SCENARIOS,
    opportunities: OPPORTUNITIES,
    jobs: JOBS,
    invoices: INVOICES,
    bills: BILLS,
    alerts: ALERTS,
    kpis: KPIS,
    integrations: INTEGRATIONS,
    reports: REPORTS,
    teamMembers: TEAM_MEMBERS,
    transactions: TRANSACTIONS,
    expenseCategories: EXPENSE_CATEGORIES,
    revenueSources: REVENUE_SOURCES,
    arAging: AR_AGING,
    apAging: AP_AGING,
  };
}
