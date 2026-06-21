export type UserRole =
  | "founder"
  | "cfo"
  | "operations"
  | "sales"
  | "project_manager"
  | "admin"
  | "staff"
  | "advisor"
  | "platform_admin";

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export type ScenarioType =
  | "base"
  | "best"
  | "worst"
  | "growth"
  | "downside"
  | "custom";

export type IntegrationStatus = "connected" | "disconnected" | "pending" | "error";

export type JobStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";

export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string;
  plan: "starter" | "growth" | "enterprise";
  createdAt: string;
  settings: OrganizationSettings;
}

export interface OrganizationSettings {
  cashAlertThreshold: number;
  forecastHorizonWeeks: number;
  fiscalYearStart: number;
  currency: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  organizationId: string;
  lastActiveAt: string;
}

export interface FinancialSnapshot {
  currentCash: number;
  forecastedCash: number;
  revenueMTD: number;
  revenueYTD: number;
  grossProfit: number;
  netProfit: number;
  operatingExpenses: number;
  accountsReceivable: number;
  accountsPayable: number;
  burnRate: number;
  runway: number;
  debtObligations: number;
  payrollObligations: number;
  ebitda: number;
}

export interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  cash: number;
}

export interface BudgetVsActual {
  category: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

export interface ForecastAssumption {
  id: string;
  category: string;
  type: "inflow" | "outflow";
  amount: number;
  frequency: "weekly" | "monthly" | "one_time";
  startDate: string;
  endDate?: string;
  notes?: string;
}

export interface CashForecastWeek {
  week: number;
  weekStart: string;
  weekEnd: string;
  startingBalance: number;
  inflows: number;
  outflows: number;
  endingBalance: number;
  isRiskPeriod: boolean;
}

export interface CashForecastMonth {
  month: string;
  inflows: number;
  outflows: number;
  endingBalance: number;
  isRiskPeriod: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  type: ScenarioType;
  revenueGrowthRate: number;
  collectionTimingDays: number;
  expenseIncreaseRate: number;
  endingCash: number;
  minimumCash: number;
  runway: number;
  description: string;
}

export interface Opportunity {
  id: string;
  name: string;
  customer: string;
  stage: DealStage;
  probability: number;
  value: number;
  expectedCloseDate: string;
  rep: string;
  source: string;
  weightedValue: number;
}

export interface Job {
  id: string;
  name: string;
  customer: string;
  status: JobStatus;
  contractValue: number;
  estimatedGrossMargin: number;
  actualGrossMargin: number;
  laborCost: number;
  materialCost: number;
  subcontractorCost: number;
  completionPercent: number;
  expectedBillingDate: string;
  expectedCollectionDate: string;
  projectManager: string;
}

export interface Invoice {
  id: string;
  number: string;
  customer: string;
  amount: number;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "overdue";
  daysOutstanding: number;
}

export interface Bill {
  id: string;
  vendor: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
  category: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  recommendedAction: string;
  affectedMetric: string;
  dueDate?: string;
  riskWindow?: string;
  owner: string;
  isRead: boolean;
  createdAt: string;
}

export type KpiStatus = "green" | "yellow" | "red";

export interface KPI {
  id: string;
  name: string;
  value: number;
  unit: "currency" | "percent" | "days" | "number";
  change: number;
  changeLabel: string;
  target?: number;
  status?: KpiStatus;
  plan?: string;
  updatedAt?: string;
  manualOverride?: boolean;
}

export interface Integration {
  id: string;
  name: string;
  category: "accounting" | "payments" | "payroll" | "operations" | "sales" | "other";
  status: IntegrationStatus;
  lastSync?: string;
  description: string;
  logo: string;
}

export interface Report {
  id: string;
  name: string;
  description: string;
  category: string;
  lastGenerated?: string;
  format: ("pdf" | "excel")[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "invited" | "inactive";
  joinedAt?: string;
  invitedAt?: string;
}

export interface PlatformTenant {
  id: string;
  name: string;
  plan: string;
  users: number;
  mrr: number;
  status: "active" | "trial" | "churned";
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense";
}

export interface ExpenseCategory {
  category: string;
  amount: number;
  percentOfRevenue: number;
}

export interface RevenueSource {
  source: string;
  amount: number;
  percent: number;
}

export interface ARAgingBucket {
  bucket: string;
  amount: number;
  count: number;
}

export interface APAgingBucket {
  bucket: string;
  amount: number;
  count: number;
}

export interface ForecastInput {
  startingCash: number;
  receivables: number;
  sales: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  payroll: number;
  rent: number;
  subcontractors: number;
  materials: number;
  operatingExpenses: number;
  loanPayments: number;
  taxes: number;
  ownerDistributions: number;
  capex: number;
}

export interface TenantData {
  organization: Organization;
  users: User[];
  financialSnapshot: FinancialSnapshot;
  monthlyTrends: MonthlyTrend[];
  budgetVsActual: BudgetVsActual[];
  forecastAssumptions: ForecastAssumption[];
  cashForecastWeeks: CashForecastWeek[];
  cashForecastMonths: CashForecastMonth[];
  scenarios: Scenario[];
  opportunities: Opportunity[];
  jobs: Job[];
  invoices: Invoice[];
  bills: Bill[];
  alerts: Alert[];
  kpis: KPI[];
  integrations: Integration[];
  reports: Report[];
  teamMembers: TeamMember[];
  transactions: Transaction[];
  expenseCategories: ExpenseCategory[];
  revenueSources: RevenueSource[];
  arAging: ARAgingBucket[];
  apAging: APAgingBucket[];
}
