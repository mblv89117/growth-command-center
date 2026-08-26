import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateDeterministicWeeklyForecast,
  buildForecastInputFromSnapshot,
} from "../src/lib/forecast/compute";
import { computeKpis } from "../src/lib/kpi/catalog";
import { computeDashboardDeltas, computeWorkingCapital } from "../src/lib/financial/deltas";
import { buildImportPreview } from "../src/lib/imports/commit";
import {
  applyImportedFinancials,
  calculateForecastedCash,
  calculateRunwayMonths,
  resolveMonthlyTrendRow,
  snapshotFromImportRow,
} from "../src/lib/imports/honesty";
import { analyzeValueCreation } from "../src/lib/value-creation/analyze";
import { slugifyCompanyName, organizationIdFromSlug } from "../src/lib/tenant/slug";
import {
  APEX_DEMO_ORGANIZATION_ID,
  EMPTY_FINANCIAL_SNAPSHOT,
  FINANCIAL_SNAPSHOT,
  getTenantData,
} from "../src/lib/mock-data";

describe("forecast compute", () => {
  it("maintains balance continuity across weeks", () => {
    const input = buildForecastInputFromSnapshot({
      currentCash: 500000,
      accountsReceivable: 200000,
      revenueMTD: 100000,
      operatingExpenses: 60000,
      payrollObligations: 40000,
      accountsPayable: 80000,
    });
    const weeks = generateDeterministicWeeklyForecast(input, 13);
    assert.equal(weeks.length, 13);
    for (const week of weeks) {
      assert.equal(week.startingBalance + week.inflows - week.outflows, week.endingBalance);
    }
  });

  it("is deterministic (no randomness)", () => {
    const input = buildForecastInputFromSnapshot({
      currentCash: 100000,
      accountsReceivable: 50000,
      revenueMTD: 80000,
      operatingExpenses: 40000,
      payrollObligations: 20000,
      accountsPayable: 30000,
    });
    const a = generateDeterministicWeeklyForecast(input);
    const b = generateDeterministicWeeklyForecast(input);
    assert.deepEqual(a, b);
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
  it("surfaces runway risk when below threshold", () => {
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
    assert.ok(board.opportunities.some((o) => o.id === "runway-risk"));
  });

  it("labels revenue-decline threshold math as CALCULATED on real trends", () => {
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
    const decline = board.opportunities.find((o) => o.id === "revenue-decline");
    assert.ok(decline);
    assert.match(decline.evidence, /^CALCULATED/);
    assert.doesNotMatch(decline.evidence, /^SOURCE-DERIVED/);
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
