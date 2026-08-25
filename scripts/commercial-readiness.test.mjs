import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateDeterministicWeeklyForecast,
  buildForecastInputFromSnapshot,
} from "../src/lib/forecast/compute";
import { computeKpis } from "../src/lib/kpi/catalog";
import { computeDashboardDeltas, computeWorkingCapital } from "../src/lib/financial/deltas";
import { buildImportPreview } from "../src/lib/imports/commit";
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
});
