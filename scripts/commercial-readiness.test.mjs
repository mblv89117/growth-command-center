import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  generateDeterministicWeeklyForecast,
  buildForecastInputFromSnapshot,
  hasExplicitWeeklyDrivers,
  isCashRiskPeriod,
  aggregateMonthlyForecast,
} from "../src/lib/forecast/compute";
import {
  applyForecastScenario,
  INSUFFICIENT_DATA,
  metricOrInsufficient,
  runwayMetricVariant,
  summarizeWeeklyForecastDisplay,
} from "../src/lib/forecast/display";
import {
  DEFAULT_SETTINGS,
  mapOrganizationRow,
  resolveCashAlertThreshold,
} from "../src/lib/data/organizations";
import { calculateMinimumCash } from "../src/lib/forecast-engine";
import { computeKpis } from "../src/lib/kpi/catalog";
import { computeDashboardDeltas, computeWorkingCapital } from "../src/lib/financial/deltas";
import { buildImportPreview } from "../src/lib/imports/commit";
import {
  applyImportedFinancials,
  calculateForecastedCash,
  calculateRunwayMonths,
  dashboardFieldProvenance,
  isEmptyFinancialSnapshot,
  resolveMonthlyTrendRow,
  snapshotFromImportRow,
} from "../src/lib/imports/honesty";
import { analyzeValueCreation } from "../src/lib/value-creation/analyze";
import { buildAdvisorDataContext } from "../src/lib/ai/advisor";
import { assessKpiRisk, getAtRiskKpis, getFinancialRiskSignals } from "../src/lib/ai/kpi-risk";
import { slugifyCompanyName, organizationIdFromSlug } from "../src/lib/tenant/slug";
import {
  APEX_DEMO_ORGANIZATION_ID,
  EMPTY_FINANCIAL_SNAPSHOT,
  FINANCIAL_SNAPSHOT,
  getTenantData,
} from "../src/lib/mock-data";

describe("forecast compute", () => {
  it("does not invent a weekly mix from snapshot revenue percents", () => {
    const input = buildForecastInputFromSnapshot({
      currentCash: 500000,
      accountsReceivable: 200000,
      revenueMTD: 100000,
      operatingExpenses: 60000,
      payrollObligations: 40000,
      accountsPayable: 80000,
    });
    assert.equal(input.sales, 0);
    assert.equal(input.recurringRevenue, 0);
    assert.equal(input.oneTimeRevenue, 0);
    assert.equal(input.rent, 0);
    assert.equal(input.subcontractors, 0);
    assert.equal(input.materials, 0);
    assert.equal(input.loanPayments, 0);
    assert.equal(input.taxes, 0);
    assert.equal(input.ownerDistributions, 0);
    assert.equal(input.capex, 0);
    assert.equal(input.payroll, 40000);
    assert.equal(input.operatingExpenses, 60000);
    assert.equal(input.receivables, 200000);
    assert.equal(hasExplicitWeeklyDrivers(input), false);
    assert.deepEqual(generateDeterministicWeeklyForecast(input, 13), []);
  });

  it("does not invent payroll or opex as a percent of revenue when those fields are missing", () => {
    const input = buildForecastInputFromSnapshot({
      currentCash: 90000,
      accountsReceivable: 0,
      revenueMTD: 40000,
      operatingExpenses: 0,
      payrollObligations: 0,
      accountsPayable: 0,
    });
    assert.equal(input.payroll, 0);
    assert.equal(input.operatingExpenses, 0);
    assert.equal(input.sales, 0);
    assert.deepEqual(generateDeterministicWeeklyForecast(input), []);
  });

  it("maintains balance continuity only for explicit SOURCE-DERIVED drivers", () => {
    const input = {
      startingCash: 500000,
      receivables: 200000,
      sales: 80000,
      recurringRevenue: 20000,
      oneTimeRevenue: 0,
      payroll: 40000,
      rent: 8000,
      subcontractors: 0,
      materials: 0,
      operatingExpenses: 60000,
      loanPayments: 0,
      taxes: 0,
      ownerDistributions: 0,
      capex: 0,
    };
    assert.equal(hasExplicitWeeklyDrivers(input), true);
    const weeks = generateDeterministicWeeklyForecast(input, 13);
    assert.equal(weeks.length, 13);
    for (const week of weeks) {
      assert.equal(week.startingBalance + week.inflows - week.outflows, week.endingBalance);
    }
  });

  it("is deterministic (no randomness) for explicit drivers", () => {
    const input = {
      startingCash: 100000,
      receivables: 50000,
      sales: 40000,
      recurringRevenue: 0,
      oneTimeRevenue: 0,
      payroll: 20000,
      rent: 0,
      subcontractors: 0,
      materials: 0,
      operatingExpenses: 40000,
      loanPayments: 0,
      taxes: 0,
      ownerDistributions: 0,
      capex: 0,
    };
    const a = generateDeterministicWeeklyForecast(input);
    const b = generateDeterministicWeeklyForecast(input);
    assert.deepEqual(a, b);
    assert.equal(a.length, 13);
  });
});

describe("cash forecast empty-state honesty", () => {
  it("empty weeks are INSUFFICIENT_DATA without invented $0 week-13 or -Infinity min cash", () => {
    const empty = summarizeWeeklyForecastDisplay([]);
    const missing = summarizeWeeklyForecastDisplay(undefined);
    const fromSnapshot = generateDeterministicWeeklyForecast(
      buildForecastInputFromSnapshot({
        currentCash: 90000,
        accountsReceivable: 0,
        revenueMTD: 40000,
        operatingExpenses: 0,
        payrollObligations: 0,
        accountsPayable: 0,
      })
    );

    assert.deepEqual(fromSnapshot, []);
    assert.equal(empty.provenance, INSUFFICIENT_DATA);
    assert.equal(missing.provenance, INSUFFICIENT_DATA);
    assert.equal(empty.scenariosEnabled, false);
    assert.deepEqual(empty.weeks, []);
    assert.equal(empty.endingWeek13, null);
    assert.equal(empty.minCash, null);
    assert.equal(empty.riskWeekCount, 0);
    assert.equal(metricOrInsufficient(empty.endingWeek13), INSUFFICIENT_DATA);
    assert.equal(metricOrInsufficient(empty.minCash), INSUFFICIENT_DATA);
    assert.equal(calculateMinimumCash([]), null);
    assert.notEqual(empty.minCash, Number.NEGATIVE_INFINITY);
    assert.notEqual(empty.endingWeek13, 0);
    assert.match(empty.riskCopy, /INSUFFICIENT_DATA/);
    assert.doesNotMatch(empty.riskCopy, /risk periods identified/i);
    assert.match(empty.emptyStateCopy, /will not invent a 13-week series/);
  });

  it("keeps scenario buttons inert and does not invent weeks from empty SOURCE-DERIVED series", () => {
    assert.deepEqual(applyForecastScenario([], "best"), []);
    assert.deepEqual(applyForecastScenario([], "worst"), []);
    const empty = summarizeWeeklyForecastDisplay(applyForecastScenario([], "best"));
    assert.equal(empty.scenariosEnabled, false);
    assert.equal(empty.provenance, INSUFFICIENT_DATA);
    assert.equal(empty.weeks.length, 0);
  });

  it("summarizes SOURCE-DERIVED weeks without padding a missing week 13", () => {
    const weeks = [
      {
        week: 1,
        weekStart: "2026-01-05",
        weekEnd: "2026-01-11",
        startingBalance: 200000,
        inflows: 10000,
        outflows: 80000,
        endingBalance: 130000,
        isRiskPeriod: true,
      },
      {
        week: 2,
        weekStart: "2026-01-12",
        weekEnd: "2026-01-18",
        startingBalance: 130000,
        inflows: 20000,
        outflows: 10000,
        endingBalance: 140000,
        isRiskPeriod: true,
      },
    ];
    const display = summarizeWeeklyForecastDisplay(weeks);
    assert.equal(display.provenance, "CALCULATED");
    assert.equal(display.scenariosEnabled, true);
    assert.equal(display.weeks.length, 2);
    assert.equal(display.endingWeek13, null);
    assert.equal(display.minCash, 130000);
    assert.equal(display.riskWeekCount, 2);
    assert.equal(metricOrInsufficient(display.endingWeek13), INSUFFICIENT_DATA);
    assert.equal(metricOrInsufficient(display.minCash), 130000);
    assert.match(display.riskCopy, /2 risk periods identified/);
    assert.doesNotMatch(display.riskCopy, /\$150K|150000/);
    assert.equal(calculateMinimumCash(weeks), 130000);

    const best = applyForecastScenario(weeks, "best");
    assert.equal(best.length, 2);
    assert.notEqual(best[0].inflows, weeks[0].inflows);
  });

  it("imported cash+burn still has no invented weekly series for the page helper", () => {
    const snapshot = snapshotFromImportRow({
      current_cash: 90000,
      burn_rate: 15000,
      revenue_mtd: 40000,
    });
    const imported = applyImportedFinancials("org-summit", snapshot);
    const display = summarizeWeeklyForecastDisplay(imported.cashForecastWeeks);

    assert.deepEqual(imported.cashForecastWeeks, []);
    assert.equal(display.provenance, INSUFFICIENT_DATA);
    assert.equal(display.endingWeek13, null);
    assert.equal(display.minCash, null);
    assert.equal(display.scenariosEnabled, false);
    assert.equal(imported.fieldProvenance.runway, "CALCULATED");
    assert.equal(imported.financialSnapshot.runway, 6);
  });
});

describe("KPI catalog", () => {
  it("computes gross margin from snapshot", () => {
    const kpis = computeKpis({
      snapshot: {
        currentCash: 100000,
        forecastedCash: 120000,
        revenueMTD: 200000,
        revenueYTD: 500000,
        grossProfit: 80000,
        netProfit: 40000,
        operatingExpenses: 40000,
        accountsReceivable: 50000,
        accountsPayable: 30000,
        burnRate: 20000,
        runway: 5,
        debtObligations: 0,
        payrollObligations: 30000,
        ebitda: 45000,
      },
      trends: [
        { month: "Jan", revenue: 180000, expenses: 120000, profit: 60000, cash: 90000 },
        { month: "Feb", revenue: 200000, expenses: 130000, profit: 70000, cash: 100000 },
      ],
    });
    const grossMargin = kpis.find((k) => k.key === "gross_margin");
    assert.ok(grossMargin);
    assert.equal(grossMargin.value, 40);
  });
});

describe("financial deltas", () => {
  it("computes working capital", () => {
    const wc = computeWorkingCapital({
      currentCash: 100000,
      forecastedCash: 120000,
      revenueMTD: 50000,
      revenueYTD: 200000,
      grossProfit: 30000,
      netProfit: 15000,
      operatingExpenses: 20000,
      accountsReceivable: 80000,
      accountsPayable: 40000,
      burnRate: 10000,
      runway: 10,
      debtObligations: 0,
      payrollObligations: 15000,
      ebitda: 20000,
    });
    assert.equal(wc, 140000);
  });

  it("does not invent percent changes without a prior period", () => {
    const snapshot = {
      currentCash: 100000,
      forecastedCash: 120000,
      revenueMTD: 50000,
      revenueYTD: 200000,
      grossProfit: 30000,
      netProfit: 15000,
      operatingExpenses: 20000,
      accountsReceivable: 80000,
      accountsPayable: 40000,
      burnRate: 10000,
      runway: 10,
      debtObligations: 0,
      payrollObligations: 15000,
      ebitda: 20000,
    };
    const deltas = computeDashboardDeltas(snapshot, []);
    assert.equal(deltas.currentCash.change, 0);
    assert.equal(deltas.accountsReceivable.change, 0);
    assert.equal(deltas.accountsPayable.change, 0);
    assert.equal(deltas.runway.change, 0);
    assert.equal(deltas.ebitda.change, 0);
    assert.equal(deltas.currentCash.direction, "flat");
  });
});

describe("import preview", () => {
  it("validates required fields", () => {
    const preview = buildImportPreview(
      "financial_snapshot",
      "test.csv",
      ["current_cash", "revenue_mtd"],
      [["500000", "100000"]]
    );
    assert.equal(preview.validCount, 1);
    assert.equal(preview.errorCount, 0);
  });

  it("flags missing required fields", () => {
    const preview = buildImportPreview(
      "financial_snapshot",
      "test.csv",
      ["revenue_mtd"],
      [["100000"]]
    );
    assert.equal(preview.validCount, 0);
    assert.equal(preview.errorCount, 1);
  });
});

describe("honest ingest", () => {
  it("does not invent monthly expenses as a percent of revenue", () => {
    const missing = resolveMonthlyTrendRow({ month: "Jan", revenue: 100000 });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.match(missing.error, /will not invent/i);
    }
    assert.doesNotMatch(JSON.stringify(missing), /0\.7|70000/);
  });

  it("calculates profit only when expenses are SOURCE-DERIVED", () => {
    const resolved = resolveMonthlyTrendRow({
      month: "Jan",
      revenue: 100000,
      expenses: 40000,
    });
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(resolved.trend.profit, 60000);
      assert.equal(resolved.profitProvenance, "CALCULATED");
      assert.equal(resolved.expensesProvenance, "SOURCE-DERIVED");
    }
  });

  it("applies imported snapshot as SOURCE-DERIVED without Apex leak", () => {
    const preview = buildImportPreview(
      "financial_snapshot",
      "books.csv",
      ["current_cash", "revenue_mtd", "accounts_receivable"],
      [["125000", "40000", "18000"]]
    );
    assert.equal(preview.validCount, 1);
    const snapshot = snapshotFromImportRow(preview.rows[0].data);
    const summit = applyImportedFinancials("org-summit", snapshot);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(summit.financialProvenance, "SOURCE-DERIVED");
    assert.equal(summit.dataSource, "imported");
    assert.equal(summit.financialSnapshot.currentCash, 125000);
    assert.equal(summit.financialSnapshot.revenueMTD, 40000);
    assert.equal(summit.invoices.length, 0);
    assert.equal(summit.jobs.length, 0);
    assert.notEqual(summit.financialSnapshot.currentCash, apex.financialSnapshot.currentCash);
    assert.equal(
      summit.integrations.filter((item) => item.status === "connected").length,
      0
    );
    assert.equal(
      summit.reports.every((report) => report.lastGenerated === undefined),
      true
    );
  });
});

describe("forecast KPI honesty", () => {
  it("empty tenant has no Apex forecast weeks, scenarios, or KPIs", () => {
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    const emptyOrgs = ["org-summit", "org-acme-services", "org-unknown-tenant", "org-hvcg"];

    assert.ok(apex.cashForecastWeeks.length > 0);
    assert.ok(apex.scenarios.length > 0);
    assert.ok(apex.kpis.length > 0);

    for (const orgId of emptyOrgs) {
      const tenant = getTenantData(orgId);
      assert.deepEqual(tenant.cashForecastWeeks, []);
      assert.deepEqual(tenant.scenarios, []);
      assert.deepEqual(tenant.kpis, []);
      assert.equal(tenant.financialSnapshot.forecastedCash, 0);
      assert.equal(tenant.financialSnapshot.runway, 0);
      assert.notDeepEqual(tenant.cashForecastWeeks, apex.cashForecastWeeks);
      assert.equal(JSON.stringify(tenant).includes("Harbor View"), false);
      assert.equal(JSON.stringify(tenant).includes("Apex Construction"), false);
    }
  });

  it("calculates runway from imported cash+burn without Apex leak", () => {
    const snapshot = snapshotFromImportRow({
      current_cash: 120000,
      burn_rate: 20000,
      revenue_mtd: 50000,
      gross_profit: 20000,
    });
    assert.equal(snapshot.runway, calculateRunwayMonths(120000, 20000));
    assert.equal(snapshot.runway, 6);
    assert.equal(snapshot.forecastedCash, calculateForecastedCash(120000, 20000));
    assert.notEqual(snapshot.forecastedCash, 0);

    const summit = applyImportedFinancials("org-summit", snapshot, []);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(summit.fieldProvenance.runway, "CALCULATED");
    assert.equal(summit.fieldProvenance.forecastedCash, "CALCULATED");
    assert.equal(summit.fieldProvenance.burnRate, "SOURCE-DERIVED");
    assert.equal(summit.financialSnapshot.runway, 6);
    assert.equal(summit.kpiProvenance, "CALCULATED");
    assert.ok(summit.kpis.some((kpi) => kpi.id === "gross_margin" && kpi.value === 40));
    assert.ok(summit.kpis.some((kpi) => kpi.id === "cash_runway" && kpi.value === 6));
    assert.deepEqual(summit.cashForecastWeeks, []);
    assert.deepEqual(summit.scenarios, []);
    assert.equal(summit.invoices.length, 0);
    assert.equal(summit.jobs.length, 0);
    assert.notEqual(summit.financialSnapshot.currentCash, apex.financialSnapshot.currentCash);
    assert.notDeepEqual(summit.cashForecastWeeks, apex.cashForecastWeeks);
    assert.equal(JSON.stringify(summit).includes("Harbor View"), false);
    assert.doesNotMatch(JSON.stringify(summit), /0\.6|0\.35|revenue \* /);
  });

  it("does not invent runway when burn is missing", () => {
    const snapshot = snapshotFromImportRow({
      current_cash: 120000,
      revenue_mtd: 50000,
    });
    assert.equal(snapshot.runway, 0);
    assert.equal(snapshot.forecastedCash, 0);
    assert.equal(snapshot.burnRate, 0);
    assert.equal(calculateRunwayMonths(120000, null), null);

    const summit = applyImportedFinancials("org-summit", snapshot);
    assert.equal(summit.financialSnapshot.runway, 0);
    assert.equal(summit.financialSnapshot.forecastedCash, 0);
    assert.equal(summit.fieldProvenance.runway, "INSUFFICIENT_DATA");
    assert.equal(summit.fieldProvenance.forecastedCash, "INSUFFICIENT_DATA");
    assert.equal(summit.fieldProvenance.burnRate, "INSUFFICIENT_DATA");
    assert.equal(
      summit.kpis.some((kpi) => kpi.id === "cash_runway"),
      false
    );
    assert.deepEqual(summit.cashForecastWeeks, []);
    assert.deepEqual(summit.scenarios, []);
  });
});

describe("value creation", () => {
  it("does not invent runway-risk from a hardcoded 6-month threshold", () => {
    const board = analyzeValueCreation({
      organizationId: "org-test",
      snapshot: {
        currentCash: 100000,
        forecastedCash: 80000,
        revenueMTD: 50000,
        revenueYTD: 200000,
        grossProfit: 20000,
        netProfit: 10000,
        operatingExpenses: 30000,
        accountsReceivable: 40000,
        accountsPayable: 20000,
        burnRate: 25000,
        runway: 4,
        debtObligations: 0,
        payrollObligations: 15000,
        ebitda: 12000,
      },
      trends: [],
      kpis: [],
      alerts: [],
    });
    assert.equal(
      board.opportunities.some((o) => o.id === "runway-risk"),
      false,
      "runway 4 without an owner target must not invent a 6-month safety threshold"
    );
    assert.equal(
      board.opportunities.some((o) => o.id === "opex-efficiency"),
      false,
      "runway-only input must not invent a 35% OpEx industry threshold"
    );
    assert.equal(JSON.stringify(board).includes("6-month"), false);
  });

  it("surfaces runway-risk only against an owner KPI target", () => {
    const board = analyzeValueCreation({
      organizationId: "org-summit",
      snapshot: {
        currentCash: 100000,
        forecastedCash: 80000,
        revenueMTD: 50000,
        revenueYTD: 200000,
        grossProfit: 20000,
        netProfit: 10000,
        operatingExpenses: 30000,
        accountsReceivable: 40000,
        accountsPayable: 20000,
        burnRate: 25000,
        runway: 4,
        debtObligations: 0,
        payrollObligations: 15000,
        ebitda: 12000,
      },
      trends: [],
      kpis: [
        {
          id: "cash_runway",
          name: "Cash Runway",
          value: 4,
          unit: "number",
          change: 0,
          changeLabel: "vs owner target",
          target: 8,
        },
      ],
      alerts: [],
    });
    const runway = board.opportunities.find((o) => o.id === "runway-risk");
    assert.ok(runway);
    assert.match(runway.finding, /4 months vs 8-month owner target/);
    assert.match(runway.evidence, /^CALCULATED: current cash \$100,000, burn \$25,000\/mo = 4 vs owner target 8/);
    assert.doesNotMatch(runway.finding, /6-month safety threshold/);
    assert.doesNotMatch(runway.evidence, /6-month/);
    assert.equal(runway.confidence, "VERIFIED");
  });

  it("does not invent ap-optimization from AP > AR * 0.8", () => {
    const board = analyzeValueCreation({
      organizationId: "org-summit",
      snapshot: {
        currentCash: 90000,
        forecastedCash: 0,
        revenueMTD: 100000,
        revenueYTD: 400000,
        grossProfit: 40000,
        netProfit: 10000,
        operatingExpenses: 30000,
        accountsReceivable: 20000,
        accountsPayable: 18000,
        burnRate: 15000,
        runway: 6,
        debtObligations: 0,
        payrollObligations: 20000,
        ebitda: 12000,
      },
      trends: [],
      kpis: [],
      alerts: [],
    });
    assert.equal(18000 > 20000 * 0.8, true, "fixture would have triggered the invented 0.8 rule");
    assert.equal(
      board.opportunities.some((o) => o.id === "ap-optimization"),
      false
    );
    assert.equal(JSON.stringify(board).includes("AP/AR"), false);
    assert.equal(JSON.stringify(board).includes("0.8"), false);
  });

  it("surfaces ap-optimization only against an owner AP-days target", () => {
    const board = analyzeValueCreation({
      organizationId: "org-summit",
      snapshot: {
        currentCash: 90000,
        forecastedCash: 0,
        revenueMTD: 100000,
        revenueYTD: 400000,
        grossProfit: 40000,
        netProfit: 10000,
        operatingExpenses: 30000,
        accountsReceivable: 20000,
        accountsPayable: 40000,
        burnRate: 15000,
        runway: 6,
        debtObligations: 0,
        payrollObligations: 20000,
        ebitda: 12000,
      },
      trends: [],
      kpis: [
        {
          id: "ap_days",
          name: "AP Days",
          value: 40,
          unit: "days",
          change: 0,
          changeLabel: "vs owner target",
          target: 30,
        },
      ],
      alerts: [],
    });
    const ap = board.opportunities.find((o) => o.id === "ap-optimization");
    assert.ok(ap);
    assert.match(ap.finding, /40 vs 30-day owner target/);
    assert.match(ap.evidence, /^CALCULATED: AP \$40,000 vs owner AP-days target 30/);
    assert.doesNotMatch(ap.finding, /0\.8|80%/);
    assert.doesNotMatch(ap.evidence, /0\.8/);
    assert.equal(ap.financialImpact, 10000);
    assert.equal(ap.confidence, "VERIFIED");
  });

  it("does not invent an opex-efficiency opportunity from revenueMTD * 0.35", () => {
    const board = analyzeValueCreation({
      organizationId: "org-summit",
      snapshot: {
        currentCash: 90000,
        forecastedCash: 0,
        revenueMTD: 100000,
        revenueYTD: 400000,
        grossProfit: 40000,
        netProfit: 10000,
        operatingExpenses: 50000,
        accountsReceivable: 20000,
        accountsPayable: 10000,
        burnRate: 15000,
        runway: 6,
        debtObligations: 0,
        payrollObligations: 20000,
        ebitda: 12000,
      },
      trends: [],
      kpis: [],
      alerts: [],
    });
    assert.equal(
      board.opportunities.some((o) => o.id === "opex-efficiency"),
      false
    );
    assert.equal(JSON.stringify(board).includes("35% of revenue"), false);
    assert.equal(JSON.stringify(board).includes("revenueMTD * 0.35"), false);
  });

  it("surfaces opex-efficiency only against an owner KPI target", () => {
    const board = analyzeValueCreation({
      organizationId: "org-summit",
      snapshot: {
        currentCash: 90000,
        forecastedCash: 0,
        revenueMTD: 100000,
        revenueYTD: 400000,
        grossProfit: 40000,
        netProfit: 10000,
        operatingExpenses: 50000,
        accountsReceivable: 20000,
        accountsPayable: 10000,
        burnRate: 15000,
        runway: 6,
        debtObligations: 0,
        payrollObligations: 20000,
        ebitda: 12000,
      },
      trends: [],
      kpis: [
        {
          id: "opex_ratio",
          name: "OpEx Ratio",
          value: 50,
          unit: "percent",
          change: 0,
          changeLabel: "vs owner target",
          target: 40,
        },
      ],
      alerts: [],
    });
    const opex = board.opportunities.find((o) => o.id === "opex-efficiency");
    assert.ok(opex);
    assert.match(opex.finding, /50% vs 40% owner target/);
    assert.match(opex.evidence, /^CALCULATED: OpEx \$50,000 \/ Revenue \$100,000 = 50% vs owner target 40%/);
    assert.doesNotMatch(opex.finding, /35%/);
    assert.doesNotMatch(opex.evidence, /35%/);
    assert.equal(opex.financialImpact, 10000);
    assert.equal(opex.confidence, "VERIFIED");
  });

  it("does not invent revenue-decline from latest < 90% of first of last 3", () => {
    const board = analyzeValueCreation({
      organizationId: "org-summit",
      snapshot: {
        currentCash: 100000,
        forecastedCash: 0,
        revenueMTD: 40000,
        revenueYTD: 180000,
        grossProfit: 12000,
        netProfit: 4000,
        operatingExpenses: 20000,
        accountsReceivable: 10000,
        accountsPayable: 8000,
        burnRate: 15000,
        runway: 6.7,
        debtObligations: 0,
        payrollObligations: 10000,
        ebitda: 0,
      },
      trends: [
        { month: "Jan", revenue: 100000, expenses: 60000, profit: 40000, cash: 120000 },
        { month: "Feb", revenue: 95000, expenses: 62000, profit: 33000, cash: 110000 },
        { month: "Mar", revenue: 80000, expenses: 61000, profit: 19000, cash: 100000 },
      ],
      kpis: [],
      alerts: [],
    });
    assert.equal(80000 < 100000 * 0.9, true, "fixture would have triggered the invented 90% rule");
    const decline = board.opportunities.find((o) => o.id === "revenue-decline");
    assert.equal(decline, undefined);
    assert.equal(JSON.stringify(board).includes("90%"), false);
  });

  it("surfaces revenue-decline only against an owner growth target", () => {
    const board = analyzeValueCreation({
      organizationId: "org-summit",
      snapshot: {
        currentCash: 100000,
        forecastedCash: 0,
        revenueMTD: 40000,
        revenueYTD: 180000,
        grossProfit: 12000,
        netProfit: 4000,
        operatingExpenses: 20000,
        accountsReceivable: 10000,
        accountsPayable: 8000,
        burnRate: 15000,
        runway: 6.7,
        debtObligations: 0,
        payrollObligations: 10000,
        ebitda: 0,
      },
      trends: [
        { month: "Jan", revenue: 100000, expenses: 60000, profit: 40000, cash: 120000 },
        { month: "Feb", revenue: 95000, expenses: 62000, profit: 33000, cash: 110000 },
        { month: "Mar", revenue: 80000, expenses: 61000, profit: 19000, cash: 100000 },
      ],
      kpis: [
        {
          id: "revenue_growth",
          name: "Revenue Growth",
          value: -15.8,
          unit: "percent",
          change: 0,
          changeLabel: "vs owner target",
          target: 10,
        },
      ],
      alerts: [],
    });
    const decline = board.opportunities.find((o) => o.id === "revenue-decline");
    assert.ok(decline);
    assert.match(decline.finding, /-15\.8% vs 10% owner target/);
    assert.match(decline.evidence, /^CALCULATED from SOURCE-DERIVED monthly trends vs owner target 10%/);
    assert.doesNotMatch(decline.evidence, /90%/);
    assert.doesNotMatch(decline.finding, /90%/);
    assert.equal(decline.financialImpact, 15000);
    assert.equal(decline.confidence, "VERIFIED");
  });

  it("empty tenant has no invented value-creation opportunities", () => {
    const empty = getTenantData("org-summit");
    assert.equal(isEmptyFinancialSnapshot(empty.financialSnapshot), true);
    const board = analyzeValueCreation({
      organizationId: "org-summit",
      snapshot: empty.financialSnapshot,
      trends: empty.monthlyTrends,
      kpis: empty.kpis,
      alerts: empty.alerts,
    });
    assert.deepEqual(board.opportunities, []);
    assert.equal(board.verifiedImpact, 0);
    assert.equal(board.estimatedImpact, 0);
    assert.match(board.summary, /Import or connect/);
    assert.equal(JSON.stringify(board).includes("Harbor View"), false);
    assert.equal(JSON.stringify(board).includes("Apex Construction"), false);
  });
});

describe("AI CFO honesty", () => {
  it("empty tenant advisor context is INSUFFICIENT_DATA without Apex leak or invented runway risk", () => {
    const empty = getTenantData("org-summit");
    const provenance = dashboardFieldProvenance("org-summit", empty.financialSnapshot);
    assert.equal(provenance.currentCash, "INSUFFICIENT_DATA");
    assert.equal(provenance.runway, "INSUFFICIENT_DATA");
    assert.deepEqual(getFinancialRiskSignals(empty.financialSnapshot, provenance), []);

    const context = buildAdvisorDataContext({
      organizationName: "Summit",
      dashboard: {
        financialSnapshot: empty.financialSnapshot,
        monthlyTrends: [],
        budgetVsActual: [],
        kpis: [],
        alerts: [],
        source: "mock",
        fieldProvenance: provenance,
      },
    });

    assert.match(context, /INSUFFICIENT_DATA/);
    assert.match(context, /Do not invent financial values/);
    assert.doesNotMatch(context, /CALCULATED financial snapshot/);
    assert.doesNotMatch(context, /Runway is 0\.0 months/);
    assert.doesNotMatch(context, /cash risk elevated/);
    assert.equal(context.includes("Harbor View"), false);
    assert.equal(context.includes("Apex Construction"), false);
    assert.doesNotMatch(context, /487,?250|412,?800/);
  });

  it("imported cash+burn advisor context uses SOURCE-DERIVED and CALCULATED only", () => {
    const snapshot = snapshotFromImportRow({
      current_cash: 90000,
      burn_rate: 15000,
      revenue_mtd: 40000,
    });
    const imported = applyImportedFinancials("org-summit", snapshot);
    assert.equal(imported.financialSnapshot.runway, calculateRunwayMonths(90000, 15000));
    assert.equal(imported.financialSnapshot.forecastedCash, calculateForecastedCash(90000, 15000));

    const context = buildAdvisorDataContext({
      organizationName: "Summit",
      dashboard: {
        financialSnapshot: imported.financialSnapshot,
        monthlyTrends: imported.monthlyTrends,
        budgetVsActual: [],
        kpis: imported.kpis,
        alerts: [],
        source: "mock",
        fieldProvenance: imported.fieldProvenance,
      },
    });

    assert.match(context, /Current cash: \$90,000 \(SOURCE-DERIVED\)/);
    assert.match(context, /Burn rate: \$15,000\/mo \(SOURCE-DERIVED\)/);
    assert.match(context, /Runway \(months\): 6 \(CALCULATED\)/);
    assert.match(context, /Forecasted cash \(13wk\): \$45,000 \(CALCULATED\)|Forecasted cash \(13wk\): \$44,965 \(CALCULATED\)/);
    assert.match(context, /Revenue MTD: \$40,000 \(SOURCE-DERIVED\)/);
    assert.match(context, /EBITDA: INSUFFICIENT_DATA/);
    assert.doesNotMatch(context, /CALCULATED financial snapshot/);
    assert.doesNotMatch(context, /cash risk elevated|meaningful cash decline|Burn rate is high relative to revenue/);
    assert.equal(context.includes("Harbor View"), false);
    assert.equal(context.includes("Apex Construction"), false);
    assert.doesNotMatch(context, /487,?250|412,?800/);
  });
});

describe("AI CFO leftover kpi-risk honesty", () => {
  const populated = {
    currentCash: 100000,
    forecastedCash: 80000,
    revenueMTD: 50000,
    revenueYTD: 200000,
    grossProfit: 20000,
    netProfit: 10000,
    operatingExpenses: 30000,
    accountsReceivable: 40000,
    accountsPayable: 20000,
    burnRate: 25000,
    runway: 4,
    debtObligations: 0,
    payrollObligations: 15000,
    ebitda: 12000,
  };

  it("does not invent runway<6, forecastedCash*0.85, or burn>revenue*0.9 signals", () => {
    assert.equal(populated.runway < 6, true);
    assert.equal(populated.forecastedCash < populated.currentCash * 0.85, true);
    assert.equal(populated.burnRate > populated.revenueMTD * 0.9, false);

    const highBurn = { ...populated, burnRate: 46000 };
    assert.equal(highBurn.burnRate > highBurn.revenueMTD * 0.9, true);

    const noTarget = getFinancialRiskSignals(populated);
    const highBurnSignals = getFinancialRiskSignals(highBurn);
    const joined = `${noTarget.join(" | ")} || ${highBurnSignals.join(" | ")}`;

    assert.equal(noTarget.some((s) => /cash risk elevated/i.test(s)), false);
    assert.equal(noTarget.some((s) => /meaningful cash decline/i.test(s)), false);
    assert.equal(highBurnSignals.some((s) => /Burn rate is high relative to revenue/i.test(s)), false);
    assert.doesNotMatch(joined, /6-month/);
    assert.doesNotMatch(joined, /0\.85/);
    assert.doesNotMatch(joined, /0\.9/);
    assert.equal(JSON.stringify(noTarget).includes("Harbor View"), false);
    assert.equal(JSON.stringify(highBurnSignals).includes("Apex Construction"), false);
  });

  it("empty tenant still returns no invented kpi-risk signals", () => {
    const empty = getTenantData("org-summit");
    const provenance = dashboardFieldProvenance("org-summit", empty.financialSnapshot);
    assert.deepEqual(getFinancialRiskSignals(empty.financialSnapshot, provenance), []);
    assert.deepEqual(getAtRiskKpis(empty.kpis), []);
  });

  it("surfaces cash-runway risk only against an owner KPI target", () => {
    const assessment = assessKpiRisk({
      id: "cash_runway",
      name: "Cash Runway",
      value: 4,
      unit: "number",
      change: 0,
      changeLabel: "vs owner target",
      target: 8,
    });
    assert.ok(assessment);
    assert.equal(assessment.level, "red");
    assert.match(assessment.reason, /4 vs 8/);
    assert.doesNotMatch(assessment.reason, /6-month|0\.85|0\.9/);

    const atRisk = getAtRiskKpis([
      {
        id: "cash_runway",
        name: "Cash Runway",
        value: 4,
        unit: "number",
        change: 0,
        changeLabel: "vs owner target",
        target: 8,
      },
    ]);
    assert.equal(atRisk.length, 1);
    assert.equal(atRisk[0].kpi.id, "cash_runway");
  });

  it("does not invent netProfit/grossProfit<0.25 or AR>revenueMTD*1.5 signals", () => {
    const thinMargin = { ...populated, netProfit: 4000, grossProfit: 20000 };
    const elevatedAr = { ...populated, accountsReceivable: 80000, revenueMTD: 50000 };
    assert.equal(thinMargin.netProfit / thinMargin.grossProfit < 0.25, true);
    assert.equal(elevatedAr.accountsReceivable > elevatedAr.revenueMTD * 1.5, true);

    const thinSignals = getFinancialRiskSignals(thinMargin);
    const arSignals = getFinancialRiskSignals(elevatedAr);
    const joined = `${thinSignals.join(" | ")} || ${arSignals.join(" | ")}`;

    assert.equal(thinSignals.some((s) => /thin relative to gross profit/i.test(s)), false);
    assert.equal(arSignals.some((s) => /elevated vs monthly revenue/i.test(s)), false);
    assert.doesNotMatch(joined, /0\.25/);
    assert.doesNotMatch(joined, /1\.5/);
    assert.equal(JSON.stringify(thinSignals).includes("Harbor View"), false);
    assert.equal(JSON.stringify(arSignals).includes("Apex Construction"), false);
  });

  it("keeps SOURCE-DERIVED negative net profit and owner-target paths", () => {
    const loss = { ...populated, netProfit: -2500, grossProfit: 20000 };
    const lossSignals = getFinancialRiskSignals(loss);
    assert.equal(lossSignals.some((s) => /Net profit is negative/i.test(s)), true);
    assert.equal(lossSignals.some((s) => /thin relative to gross profit/i.test(s)), false);

    const assessment = assessKpiRisk({
      id: "gross_margin",
      name: "Gross Margin",
      value: 20,
      unit: "percent",
      change: 0,
      changeLabel: "vs owner target",
      target: 40,
    });
    assert.ok(assessment);
    assert.equal(assessment.level, "red");
    assert.match(assessment.reason, /20 vs 40/);
    assert.doesNotMatch(assessment.reason, /0\.25|1\.5|thin relative/);
  });
});

describe("forecast leftover endingBalance honesty", () => {
  const explicitDrivers = {
    startingCash: 200000,
    receivables: 0,
    sales: 10000,
    recurringRevenue: 0,
    oneTimeRevenue: 0,
    payroll: 5000,
    rent: 0,
    subcontractors: 0,
    materials: 0,
    operatingExpenses: 0,
    loanPayments: 0,
    taxes: 0,
    ownerDistributions: 0,
    capex: 0,
  };

  it("does not invent endingBalance < 150000 as a cash-risk rule", () => {
    assert.equal(isCashRiskPeriod(149999), false);
    assert.equal(isCashRiskPeriod(149999, null), false);
    assert.equal(isCashRiskPeriod(149999, 0), false);

    const weeks = generateDeterministicWeeklyForecast(explicitDrivers, 2);
    assert.equal(weeks.length, 2);
    assert.equal(
      weeks.some((week) => week.endingBalance < 150000 && week.endingBalance >= 0 && week.isRiskPeriod),
      false
    );

    const months = aggregateMonthlyForecast([
      {
        week: 1,
        weekStart: "2026-01-05",
        weekEnd: "2026-01-11",
        startingBalance: 200000,
        inflows: 10000,
        outflows: 80000,
        endingBalance: 130000,
        isRiskPeriod: false,
      },
    ]);
    assert.equal(months[0].endingBalance, 130000);
    assert.equal(months[0].isRiskPeriod, false);

    const scenario = applyForecastScenario(
      [
        {
          week: 1,
          weekStart: "2026-01-05",
          weekEnd: "2026-01-11",
          startingBalance: 140000,
          inflows: 10000,
          outflows: 20000,
          endingBalance: 130000,
          isRiskPeriod: false,
        },
      ],
      "worst"
    );
    assert.equal(scenario.length, 1);
    assert.equal(scenario[0].endingBalance < 150000, true);
    assert.equal(scenario[0].isRiskPeriod, scenario[0].endingBalance < 0);

    const display = summarizeWeeklyForecastDisplay(weeks);
    assert.doesNotMatch(display.riskCopy, /\$150K|150000|150K threshold/);
    assert.equal(JSON.stringify(weeks).includes("Harbor View"), false);
    assert.equal(JSON.stringify(months).includes("Apex Construction"), false);
  });

  it("keeps SOURCE-DERIVED negative cash and owner cash-alert target paths", () => {
    assert.equal(isCashRiskPeriod(-1), true);
    assert.equal(isCashRiskPeriod(90000, 100000), true);
    assert.equal(isCashRiskPeriod(110000, 100000), false);

    const ownerWeeks = generateDeterministicWeeklyForecast(explicitDrivers, 2, 1, 1000000);
    assert.equal(ownerWeeks.length, 2);
    assert.equal(
      ownerWeeks.every((week) => week.isRiskPeriod === week.endingBalance < 1000000),
      true
    );

    const negativeMonths = aggregateMonthlyForecast(
      [
        {
          week: 1,
          weekStart: "2026-01-05",
          weekEnd: "2026-01-11",
          startingBalance: 10000,
          inflows: 0,
          outflows: 20000,
          endingBalance: -10000,
          isRiskPeriod: true,
        },
      ]
    );
    assert.equal(negativeMonths[0].isRiskPeriod, true);

    const ownerMonths = aggregateMonthlyForecast(
      [
        {
          week: 1,
          weekStart: "2026-01-05",
          weekEnd: "2026-01-11",
          startingBalance: 200000,
          inflows: 10000,
          outflows: 80000,
          endingBalance: 130000,
          isRiskPeriod: false,
        },
      ],
      150000
    );
    assert.equal(ownerMonths[0].isRiskPeriod, true);

    const ownerScenario = applyForecastScenario(
      [
        {
          week: 1,
          weekStart: "2026-01-05",
          weekEnd: "2026-01-11",
          startingBalance: 140000,
          inflows: 10000,
          outflows: 20000,
          endingBalance: 130000,
          isRiskPeriod: false,
        },
      ],
      "worst",
      200000
    );
    assert.equal(ownerScenario[0].isRiskPeriod, ownerScenario[0].endingBalance < 200000);
  });

  it("empty tenant still has no invented 150000 forecast risk", () => {
    const empty = getTenantData("org-summit");
    const display = summarizeWeeklyForecastDisplay(empty.cashForecastWeeks);
    assert.deepEqual(empty.cashForecastWeeks, []);
    assert.equal(display.provenance, INSUFFICIENT_DATA);
    assert.equal(display.riskWeekCount, 0);
    assert.doesNotMatch(display.riskCopy, /\$150K|150000/);
    assert.equal(JSON.stringify(empty).includes("Harbor View"), false);
    assert.equal(JSON.stringify(empty).includes("Apex Construction"), false);
  });
});

describe("leftover settings seed and runway UI honesty", () => {
  it("does not invent cashAlertThreshold 150000 as a default seed", () => {
    assert.equal(DEFAULT_SETTINGS.cashAlertThreshold, 0);
    assert.equal(resolveCashAlertThreshold(undefined), 0);
    assert.equal(resolveCashAlertThreshold(null), 0);
    assert.equal(resolveCashAlertThreshold(0), 0);
    assert.equal(resolveCashAlertThreshold("150000"), 150000);

    const unsaved = mapOrganizationRow({
      id: "org-acme-services",
      name: "Acme Services",
      slug: "acme-services",
      settings: {},
    });
    assert.equal(unsaved.settings.cashAlertThreshold, 0);
    assert.notEqual(unsaved.settings.cashAlertThreshold, 150000);

    const owner = mapOrganizationRow({
      id: "org-acme-services",
      name: "Acme Services",
      slug: "acme-services",
      settings: { cashAlertThreshold: 150000 },
    });
    assert.equal(owner.settings.cashAlertThreshold, 150000);

    const unknown = getTenantData("org-unknown-tenant");
    const empty = getTenantData("org-hvcg");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(unknown.organization.settings.cashAlertThreshold, 0);
    assert.equal(empty.organization.settings.cashAlertThreshold, 0);
    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
    assert.equal(JSON.stringify(unknown).includes("Harbor View"), false);
    assert.equal(JSON.stringify(empty).includes("Apex Construction"), false);
  });

  it("does not invent a runway < 6 MetricCard warning", () => {
    assert.equal(runwayMetricVariant(4), "default");
    assert.equal(runwayMetricVariant(5.9), "default");
    assert.equal(runwayMetricVariant(0), "default");
    assert.equal(runwayMetricVariant(INSUFFICIENT_DATA), "default");
    assert.equal(runwayMetricVariant(4, 8), "warning");
    assert.equal(runwayMetricVariant(10, 8), "default");
    assert.equal(runwayMetricVariant(4, 0), "default");

    const pageSource = fs.readFileSync(
      new URL("../src/app/(dashboard)/cash-forecast/page.tsx", import.meta.url),
      "utf8"
    );
    const dashboardSource = fs.readFileSync(
      new URL("../src/app/(dashboard)/dashboard/page.tsx", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(pageSource, /runway\s*<\s*6/);
    assert.doesNotMatch(dashboardSource, /runway\s*<\s*6/);
    assert.match(pageSource, /runwayMetricVariant/);
    assert.match(dashboardSource, /runwayMetricVariant/);
  });

  it("empty tenant still has no invented 150000 settings seed", () => {
    const empty = getTenantData("org-summit");
    const mapped = mapOrganizationRow({
      id: "org-summit",
      name: "Summit",
      slug: "summit",
      settings: null,
    });
    assert.equal(mapped.settings.cashAlertThreshold, 0);
    assert.equal(JSON.stringify(empty).includes("Harbor View"), false);
    assert.equal(JSON.stringify(empty).includes("Apex Construction"), false);
    assert.doesNotMatch(JSON.stringify(mapped), /150000/);
  });
});

describe("tenant slug", () => {
  it("slugifies company names", () => {
    assert.equal(slugifyCompanyName("Acme Services LLC"), "acme-services-llc");
    assert.equal(organizationIdFromSlug("acme-services"), "org-acme-services");
  });
});

describe("tenant isolation contract", () => {
  it("demo org id is pinned constant", () => {
    assert.equal(organizationIdFromSlug("apex"), "org-apex");
    assert.notEqual(organizationIdFromSlug("summit"), organizationIdFromSlug("apex"));
  });

  it("does not leak Apex financials to other organizations", () => {
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(summit.invoices.length, 0);
    assert.equal(provisioned.jobs.length, 0);
    assert.notEqual(summit.financialSnapshot.currentCash, apex.financialSnapshot.currentCash);
    assert.notDeepEqual(summit.financialSnapshot, apex.financialSnapshot);
  });

  it("keeps QBO and Plaid disconnected in the catalog", () => {
    const catalog = getTenantData("org-acme-services").integrations;
    const qbo = catalog.find((item) => item.id === "int-1");
    const plaid = catalog.find((item) => item.id === "int-4");
    assert.ok(qbo);
    assert.ok(plaid);
    assert.equal(qbo.status, "disconnected");
    assert.equal(plaid.status, "disconnected");
  });

  it("does not mark Stripe, Gusto, HubSpot, Sheets, or any catalog item connected for empty tenants", () => {
    const emptyOrgs = ["org-summit", "org-acme-services", "org-unknown-tenant", "org-hvcg"];
    const namedConnectors = ["Stripe", "Gusto", "HubSpot", "Google Sheets"];

    for (const orgId of emptyOrgs) {
      const catalog = getTenantData(orgId).integrations;
      const connected = catalog.filter((item) => item.status === "connected");
      assert.equal(connected.length, 0, `${orgId} must not have connected catalog items`);

      for (const name of namedConnectors) {
        const item = catalog.find((entry) => entry.name === name);
        assert.ok(item, `${orgId} catalog must include ${name}`);
        assert.equal(item.status, "disconnected", `${orgId} ${name}`);
        assert.equal(item.lastSync, undefined, `${orgId} ${name} must not advertise lastSync`);
      }
    }
  });

  it("does not advertise lastGenerated demo dates on empty-tenant reports", () => {
    const emptyOrgs = ["org-summit", "org-acme-services", "org-unknown-tenant", "org-hvcg"];

    for (const orgId of emptyOrgs) {
      const reports = getTenantData(orgId).reports;
      for (const report of reports) {
        assert.equal(
          report.lastGenerated,
          undefined,
          `${orgId} ${report.id} must not advertise lastGenerated`
        );
      }
    }
  });
});
