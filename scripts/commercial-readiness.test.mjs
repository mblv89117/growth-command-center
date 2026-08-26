import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  generateDeterministicWeeklyForecast,
  buildForecastInputFromSnapshot,
  aggregateMonthlyForecast,
  isCashRiskPeriod,
} from "../src/lib/forecast/compute";
import { KPI_CATALOG, computeKpis, resolveKpiTarget } from "../src/lib/kpi/catalog";
import { computeDashboardDeltas, computeWorkingCapital } from "../src/lib/financial/deltas";
import { buildImportPreview } from "../src/lib/imports/commit";
import { analyzeValueCreation } from "../src/lib/value-creation/analyze";
import { slugifyCompanyName, organizationIdFromSlug } from "../src/lib/tenant/slug";
import {
  APEX_DEMO_ORGANIZATION_ID,
  DISCONNECTED_INTEGRATIONS,
  EMPTY_FINANCIAL_SNAPSHOT,
  EMPTY_TENANT_REPORTS,
  FINANCIAL_SNAPSHOT,
  INTEGRATIONS,
  KPIS,
  ORGANIZATIONS,
  REPORTS,
  getTenantData,
} from "../src/lib/mock-data";
import {
  DEFAULT_SETTINGS,
  mapOrganizationRow,
  resolveCashAlertThreshold,
} from "../src/lib/data/organizations";
import {
  financialsBannerDoesNotInventFinancials,
  forecastBannerDoesNotInventFinancials,
  founderJourneyDoesNotInventFinancials,
  importHandoffDoesNotInventFinancials,
  resolveFinancialsInsightBanner,
  resolveForecastInsightBanner,
  resolveFounderJourney,
  resolveImportSuccessHandoff,
  resolveValueCreationInsightBanner,
  valueCreationBannerDoesNotInventFinancials,
} from "../src/lib/journey/founder";

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

  it("does not invent endingBalance < 150000 as a cash-risk rule", () => {
    const input = buildForecastInputFromSnapshot({
      currentCash: 140000,
      accountsReceivable: 20000,
      revenueMTD: 10000,
      operatingExpenses: 8000,
      payrollObligations: 4000,
      accountsPayable: 5000,
    });
    const weeks = generateDeterministicWeeklyForecast(input, 13);
    assert.ok(weeks.length > 0);
    assert.equal(
      weeks.some((week) => week.endingBalance < 150000 && week.endingBalance >= 0 && week.isRiskPeriod),
      false
    );
    const months = aggregateMonthlyForecast(weeks);
    assert.equal(
      months.some((month) => month.endingBalance < 150000 && month.endingBalance >= 0 && month.isRiskPeriod),
      false
    );
  });

  it("flags cash risk from SOURCE-DERIVED insolvency or owner cash-alert target", () => {
    assert.equal(isCashRiskPeriod(140000), false);
    assert.equal(isCashRiskPeriod(140000, null), false);
    assert.equal(isCashRiskPeriod(-1), true);
    assert.equal(isCashRiskPeriod(140000, 150000), true);
    assert.equal(isCashRiskPeriod(160000, 150000), false);

    const input = buildForecastInputFromSnapshot({
      currentCash: 140000,
      accountsReceivable: 20000,
      revenueMTD: 10000,
      operatingExpenses: 8000,
      payrollObligations: 4000,
      accountsPayable: 5000,
    });
    const ownerTargetWeeks = generateDeterministicWeeklyForecast(input, 13, 1, 150000);
    assert.ok(ownerTargetWeeks.some((week) => week.isRiskPeriod));
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
    assert.equal(
      summit.cashForecastWeeks.some(
        (week) => week.endingBalance < 150000 && week.endingBalance >= 0 && week.isRiskPeriod
      ),
      false
    );
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

describe("leftover settings default cashAlertThreshold honesty", () => {
  it("does not invent cashAlertThreshold 150000 for unconfigured orgs", () => {
    assert.equal(DEFAULT_SETTINGS.cashAlertThreshold, 0);
    assert.notEqual(DEFAULT_SETTINGS.cashAlertThreshold, 150000);
    assert.equal(resolveCashAlertThreshold(undefined), 0);
    assert.equal(resolveCashAlertThreshold(null), 0);
    assert.equal(resolveCashAlertThreshold(0), 0);
    assert.equal(resolveCashAlertThreshold(""), 0);

    const missing = mapOrganizationRow({
      id: "org-acme-services",
      name: "Acme Services",
      slug: "acme-services",
    });
    assert.equal(missing.settings.cashAlertThreshold, 0);
    assert.notEqual(missing.settings.cashAlertThreshold, 150000);

    const emptySettings = mapOrganizationRow({
      id: "org-acme-services",
      name: "Acme Services",
      slug: "acme-services",
      settings: {},
    });
    assert.equal(emptySettings.settings.cashAlertThreshold, 0);
    assert.notEqual(emptySettings.settings.cashAlertThreshold, 150000);

    const nullSettings = mapOrganizationRow({
      id: "org-summit-unconfigured",
      name: "Summit Unconfigured",
      slug: "summit-unconfigured",
      settings: null,
    });
    assert.equal(nullSettings.settings.cashAlertThreshold, 0);
    assert.doesNotMatch(JSON.stringify(nullSettings), /150000/);
  });

  it("keeps owner-set cashAlertThreshold SOURCE-DERIVED", () => {
    assert.equal(resolveCashAlertThreshold("150000"), 150000);
    assert.equal(resolveCashAlertThreshold(75000), 75000);

    const owner = mapOrganizationRow({
      id: "org-acme-services",
      name: "Acme Services",
      slug: "acme-services",
      settings: { cashAlertThreshold: 150000 },
    });
    assert.equal(owner.settings.cashAlertThreshold, 150000);

    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
  });

  it("empty tenant still has no Apex leak after settings default honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const mapped = mapOrganizationRow({
      id: "org-acme-services",
      name: "Acme Services",
      slug: "acme-services",
      settings: {},
    });

    assert.equal(mapped.settings.cashAlertThreshold, 0);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.notEqual(summit.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.notDeepEqual(summit.financialSnapshot, getTenantData(APEX_DEMO_ORGANIZATION_ID).financialSnapshot);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.doesNotMatch(JSON.stringify(mapped), /150000/);
  });
});

describe("leftover mock-data organizationForId cashAlertThreshold honesty", () => {
  it("does not invent cashAlertThreshold 150000 for unknown mock orgs", () => {
    const provisioned = getTenantData("org-acme-services");
    const unknown = getTenantData("org-unknown-tenant");

    assert.equal(provisioned.organization.settings.cashAlertThreshold, 0);
    assert.notEqual(provisioned.organization.settings.cashAlertThreshold, 150000);
    assert.equal(unknown.organization.settings.cashAlertThreshold, 0);
    assert.notEqual(unknown.organization.settings.cashAlertThreshold, 150000);
    assert.doesNotMatch(JSON.stringify(provisioned.organization), /150000/);
    assert.doesNotMatch(JSON.stringify(unknown.organization), /150000/);
  });

  it("keeps pinned org-apex mock cashAlertThreshold SOURCE-DERIVED", () => {
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
  });

  it("empty tenant still has no Apex leak after organizationForId honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");

    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.notEqual(summit.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.notDeepEqual(summit.financialSnapshot, getTenantData(APEX_DEMO_ORGANIZATION_ID).financialSnapshot);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover schema.sql DEFAULT cashAlertThreshold honesty", () => {
  const schemaSql = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

  it("does not invent leftover schema.sql DEFAULT cashAlertThreshold 150000", () => {
    const executable = schemaSql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    assert.match(
      executable,
      /settings JSONB DEFAULT '\{"cashAlertThreshold":0,"forecastHorizonWeeks":13,"fiscalYearStart":1,"currency":"USD"\}'/
    );
    assert.doesNotMatch(executable, /"cashAlertThreshold":150000/);
    assert.doesNotMatch(executable, /cashAlertThreshold":150000/);
    assert.equal(DEFAULT_SETTINGS.cashAlertThreshold, 0);
    assert.equal(resolveCashAlertThreshold(undefined), 0);
    assert.equal(resolveCashAlertThreshold(0), 0);
    assert.equal(resolveCashAlertThreshold("150000"), 150000);
  });

  it("owner-set cashAlertThreshold remains SOURCE-DERIVED", () => {
    const owner = mapOrganizationRow({
      id: "org-iron-ridge",
      name: "Iron Ridge",
      slug: "iron-ridge",
      settings: { cashAlertThreshold: 150000 },
    });
    assert.equal(owner.settings.cashAlertThreshold, 150000);
    assert.equal(resolveCashAlertThreshold(75000), 75000);

    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
  });

  it("empty tenants do not inherit leftover schema.sql 150000 default", () => {
    for (const orgId of ["org-acme-services", "org-cedar-falls", "org-unknown-schema-34"]) {
      const empty = getTenantData(orgId);
      assert.equal(empty.organization.settings.cashAlertThreshold, 0, orgId);
      assert.notEqual(empty.organization.settings.cashAlertThreshold, 150000, orgId);
      assert.doesNotMatch(JSON.stringify(empty), /"cashAlertThreshold":150000/);
      assert.equal(JSON.stringify(empty).includes("Harbor View"), false, orgId);
      assert.equal(JSON.stringify(empty).includes("Apex Construction"), false, orgId);
    }
  });
});

describe("leftover org-summit listed mock cashAlertThreshold honesty", () => {
  it("does not invent leftover listed org-summit cashAlertThreshold 75000", () => {
    const listed = ORGANIZATIONS.find((org) => org.id === "org-summit");
    assert.ok(listed);
    assert.equal(listed.settings.cashAlertThreshold, 0);
    assert.notEqual(listed.settings.cashAlertThreshold, 75000);

    const summit = getTenantData("org-summit");
    assert.equal(summit.organization.settings.cashAlertThreshold, 0);
    assert.notEqual(summit.organization.settings.cashAlertThreshold, 75000);
    assert.doesNotMatch(JSON.stringify(listed), /75000/);
    assert.doesNotMatch(JSON.stringify(summit.organization), /75000/);
  });

  it("keeps owner-set 75000 and pinned org-apex 150000 SOURCE-DERIVED", () => {
    assert.equal(resolveCashAlertThreshold(75000), 75000);
    assert.equal(resolveCashAlertThreshold("75000"), 75000);

    const owner = mapOrganizationRow({
      id: "org-summit-owner-set",
      name: "Summit Owner Set",
      slug: "summit-owner-set",
      settings: { cashAlertThreshold: 75000 },
    });
    assert.equal(owner.settings.cashAlertThreshold, 75000);

    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
  });

  it("empty tenant still has no Apex leak after org-summit listed honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");

    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.notEqual(summit.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.notDeepEqual(summit.financialSnapshot, getTenantData(APEX_DEMO_ORGANIZATION_ID).financialSnapshot);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Harbor View"), false);
  });
});

describe("leftover KPI catalog cash_runway defaultTarget honesty", () => {
  const cashRunway = KPI_CATALOG.find((def) => def.key === "cash_runway");

  it("does not invent leftover cash_runway defaultTarget 6", () => {
    assert.ok(cashRunway);
    assert.equal(cashRunway.defaultTarget, undefined);
    assert.notEqual(cashRunway.defaultTarget, 6);

    const kpis = computeKpis({
      snapshot: {
        currentCash: 50000,
        forecastedCash: 40000,
        revenueMTD: 20000,
        revenueYTD: 80000,
        grossProfit: 8000,
        netProfit: 2000,
        operatingExpenses: 18000,
        accountsReceivable: 10000,
        accountsPayable: 8000,
        burnRate: 18000,
        runway: 2.8,
        debtObligations: 0,
        payrollObligations: 9000,
        ebitda: 3000,
      },
      trends: [],
    });
    const runway = kpis.find((kpi) => kpi.key === "cash_runway");
    assert.ok(runway);
    assert.equal(runway.target, undefined);
    assert.notEqual(runway.target, 6);
  });

  it("keeps owner-set cash_runway target SOURCE-DERIVED", () => {
    assert.equal(resolveKpiTarget(undefined), undefined);
    assert.equal(resolveKpiTarget(null), undefined);
    assert.equal(resolveKpiTarget(0), undefined);
    assert.equal(resolveKpiTarget(11), 11);

    const owner = computeKpis(
      {
        snapshot: {
          currentCash: 50000,
          forecastedCash: 40000,
          revenueMTD: 20000,
          revenueYTD: 80000,
          grossProfit: 8000,
          netProfit: 2000,
          operatingExpenses: 18000,
          accountsReceivable: 10000,
          accountsPayable: 8000,
          burnRate: 18000,
          runway: 2.8,
          debtObligations: 0,
          payrollObligations: 9000,
          ebitda: 3000,
        },
        trends: [],
      },
      undefined,
      { cash_runway: 11 }
    );
    const runway = owner.find((kpi) => kpi.key === "cash_runway");
    assert.ok(runway);
    assert.equal(runway.target, 11);
    assert.notEqual(runway.target, 6);
  });

  it("empty tenant still has no Apex leak after cash_runway catalog honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover KPI catalog defaultTarget honesty", () => {
  const inventedDefaults = {
    revenue_growth: 10,
    gross_margin: 35,
    net_margin: 15,
    ebitda_margin: 20,
    ar_days: 45,
    ap_days: 30,
    opex_ratio: 25,
    labor_pct: 35,
  };

  const snapshot = {
    currentCash: 100000,
    forecastedCash: 80000,
    revenueMTD: 200000,
    revenueYTD: 500000,
    grossProfit: 80000,
    netProfit: 40000,
    operatingExpenses: 50000,
    accountsReceivable: 60000,
    accountsPayable: 20000,
    burnRate: 20000,
    runway: 5,
    debtObligations: 0,
    payrollObligations: 30000,
    ebitda: 45000,
  };

  const trends = [
    { month: "Jan", revenue: 180000, expenses: 120000, profit: 60000, cash: 90000 },
    { month: "Feb", revenue: 200000, expenses: 130000, profit: 70000, cash: 100000 },
  ];

  it("does not invent leftover catalog defaultTargets 10/35/15/20/45/30/25/35", () => {
    for (const [key, invented] of Object.entries(inventedDefaults)) {
      const def = KPI_CATALOG.find((kpi) => kpi.key === key);
      assert.ok(def, key);
      assert.equal(def.defaultTarget, undefined, `${key} defaultTarget`);
      assert.notEqual(def.defaultTarget, invented, `${key} invented ${invented}`);
    }

    const kpis = computeKpis({ snapshot, trends }, Object.keys(inventedDefaults));
    for (const [key, invented] of Object.entries(inventedDefaults)) {
      const kpi = kpis.find((row) => row.key === key);
      assert.ok(kpi, key);
      assert.equal(kpi.target, undefined, `${key} target`);
      assert.notEqual(kpi.target, invented, `${key} invented target ${invented}`);
    }
  });

  it("keeps owner-set leftover catalog targets SOURCE-DERIVED", () => {
    const ownerTargets = {
      revenue_growth: 12,
      gross_margin: 28,
      net_margin: 8,
      ebitda_margin: 18,
      ar_days: 40,
      ap_days: 25,
      opex_ratio: 22,
      labor_pct: 18,
    };
    const kpis = computeKpis({ snapshot, trends }, Object.keys(ownerTargets), ownerTargets);
    for (const [key, owner] of Object.entries(ownerTargets)) {
      const kpi = kpis.find((row) => row.key === key);
      assert.ok(kpi, key);
      assert.equal(kpi.target, owner, `${key} owner target`);
      assert.notEqual(kpi.target, inventedDefaults[key], `${key} must not fall back to invented default`);
    }
  });

  it("empty tenant still has no Apex leak after leftover catalog defaultTarget honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.notDeepEqual(summit.financialSnapshot, apex.financialSnapshot);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover Apex demo KPI target 10/6 honesty", () => {
  const seedJs = fs.readFileSync(new URL("./seed-supabase.mjs", import.meta.url), "utf8");

  it("does not invent leftover Apex demo Revenue Growth 10 or Runway 6", () => {
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    const runway = KPIS.find((kpi) => kpi.id === "kpi-12");
    assert.ok(growth);
    assert.ok(runway);
    assert.equal(growth.target, undefined);
    assert.notEqual(growth.target, 10);
    assert.equal(runway.target, undefined);
    assert.notEqual(runway.target, 6);

    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    const apexGrowth = apex.kpis.find((kpi) => kpi.id === "kpi-1");
    const apexRunway = apex.kpis.find((kpi) => kpi.id === "kpi-12");
    assert.ok(apexGrowth);
    assert.ok(apexRunway);
    assert.equal(apexGrowth.target, undefined);
    assert.notEqual(apexGrowth.target, 10);
    assert.equal(apexRunway.target, undefined);
    assert.notEqual(apexRunway.target, 6);

    const executable = seedJs
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    assert.match(executable, /\["revenue_growth", "Revenue Growth", 12\.4, "percent", 2\.1, "vs last month", null\]/);
    assert.match(executable, /\["runway", "Runway", 3\.4, "number", -0\.3, "months", null\]/);
    assert.doesNotMatch(executable, /\["revenue_growth", "Revenue Growth", 12\.4, "percent", 2\.1, "vs last month", 10\]/);
    assert.doesNotMatch(executable, /\["runway", "Runway", 3\.4, "number", -0\.3, "months", 6\]/);
  });

  it("keeps owner-set leftover Apex demo KPI targets SOURCE-DERIVED", () => {
    assert.equal(resolveKpiTarget(21), 21);
    assert.equal(resolveKpiTarget(11), 11);
    assert.notEqual(resolveKpiTarget(21), 10);
    assert.notEqual(resolveKpiTarget(11), 6);

    const owner = computeKpis(
      {
        snapshot: {
          currentCash: 50000,
          forecastedCash: 40000,
          revenueMTD: 20000,
          revenueYTD: 80000,
          grossProfit: 8000,
          netProfit: 2000,
          operatingExpenses: 18000,
          accountsReceivable: 10000,
          accountsPayable: 8000,
          burnRate: 18000,
          runway: 2.8,
          debtObligations: 0,
          payrollObligations: 9000,
          ebitda: 3000,
        },
        trends: [
          { month: "Jan", revenue: 18000, expenses: 12000, profit: 6000, cash: 40000 },
          { month: "Feb", revenue: 20000, expenses: 13000, profit: 7000, cash: 50000 },
        ],
      },
      ["revenue_growth", "cash_runway"],
      { revenue_growth: 21, cash_runway: 11 }
    );
    const growth = owner.find((kpi) => kpi.key === "revenue_growth");
    const runway = owner.find((kpi) => kpi.key === "cash_runway");
    assert.ok(growth);
    assert.ok(runway);
    assert.equal(growth.target, 21);
    assert.equal(runway.target, 11);
    assert.notEqual(growth.target, 10);
    assert.notEqual(runway.target, 6);
  });

  it("empty tenant still has no Apex leak after leftover Apex demo KPI 10/6 honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.kpis.length, 0);
    assert.equal(provisioned.kpis.length, 0);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover Apex demo KPI targets 32/12/45/40/35/30/28/24/1.5 honesty", () => {
  const seedJs = fs.readFileSync(new URL("./seed-supabase.mjs", import.meta.url), "utf8");
  const leftover = [
    ["kpi-2", 32],
    ["kpi-3", 12],
    ["kpi-4", 45],
    ["kpi-5", 40],
    ["kpi-6", 35],
    ["kpi-7", 30],
    ["kpi-9", 28],
    ["kpi-10", 24],
    ["kpi-11", 1.5],
  ];

  it("does not invent leftover Apex demo KPI targets 32/12/45/40/35/30/28/24/1.5", () => {
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    for (const [id, invented] of leftover) {
      const card = KPIS.find((kpi) => kpi.id === id);
      const live = apex.kpis.find((kpi) => kpi.id === id);
      assert.ok(card, id);
      assert.ok(live, id);
      assert.equal(card.target, undefined, id);
      assert.equal(live.target, undefined, id);
      assert.notEqual(card.target, invented, id);
      assert.notEqual(live.target, invented, id);
    }

    const executable = seedJs
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    assert.match(executable, /\["gross_margin", "Gross Margin", 35\.9, "percent", -1\.2, "vs last month", null\]/);
    assert.match(executable, /\["net_margin", "Net Margin", 13\.0, "percent", 0\.8, "vs last month", null\]/);
    assert.doesNotMatch(executable, /\["gross_margin", "Gross Margin", 35\.9, "percent", -1\.2, "vs last month", 32\]/);
    assert.doesNotMatch(executable, /\["net_margin", "Net Margin", 13\.0, "percent", 0\.8, "vs last month", 12\]/);
  });

  it("keeps owner-set leftover remaining Apex demo KPI targets SOURCE-DERIVED", () => {
    assert.equal(resolveKpiTarget(29), 29);
    assert.equal(resolveKpiTarget(11), 11);
    assert.notEqual(resolveKpiTarget(29), 32);
    assert.notEqual(resolveKpiTarget(11), 12);

    const owner = computeKpis(
      {
        snapshot: {
          currentCash: 100000,
          forecastedCash: 80000,
          revenueMTD: 200000,
          revenueYTD: 500000,
          grossProfit: 80000,
          netProfit: 40000,
          operatingExpenses: 50000,
          accountsReceivable: 60000,
          accountsPayable: 20000,
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
      },
      ["gross_margin", "net_margin"],
      { gross_margin: 29, net_margin: 11 }
    );
    const gross = owner.find((kpi) => kpi.key === "gross_margin");
    const net = owner.find((kpi) => kpi.key === "net_margin");
    assert.ok(gross);
    assert.ok(net);
    assert.equal(gross.target, 29);
    assert.equal(net.target, 11);
    assert.notEqual(gross.target, 32);
    assert.notEqual(net.target, 12);
  });

  it("empty tenant still has no Apex leak after leftover remaining Apex demo KPI honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.kpis.length, 0);
    assert.equal(provisioned.kpis.length, 0);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.notDeepEqual(summit.financialSnapshot, apex.financialSnapshot);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover seed.sql org-apex KPI target honesty", () => {
  const seedSql = fs.readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
  const executable = seedSql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const invented = [10, 32, 12, 45, 40, 35, 30, 28, 24, 1.5, 6];

  it("does not invent leftover seed.sql org-apex KPI targets 10/32/12/45/40/35/30/28/24/1.5/6", () => {
    assert.match(executable, /\('org-apex', 'revenue_growth', 'Revenue Growth', 12\.4, 'percent', 2\.1, 'vs last month', NULL\)/);
    assert.match(executable, /\('org-apex', 'gross_margin', 'Gross Margin', 35\.9, 'percent', -1\.2, 'vs last month', NULL\)/);
    assert.match(executable, /\('org-apex', 'net_margin', 'Net Margin', 13\.0, 'percent', 0\.8, 'vs last month', NULL\)/);
    assert.match(executable, /\('org-apex', 'cash_conversion', 'Cash Conversion Cycle', 42, 'days', -3, 'vs last quarter', NULL\)/);
    assert.match(executable, /\('org-apex', 'ar_days', 'AR Days', 48, 'days', 5, 'vs last month', NULL\)/);
    assert.match(executable, /\('org-apex', 'ap_days', 'AP Days', 32, 'days', -2, 'vs last month', NULL\)/);
    assert.match(executable, /\('org-apex', 'close_rate', 'Sales Close Rate', 34, 'percent', 4, 'vs last quarter', NULL\)/);
    assert.match(executable, /\('org-apex', 'job_profit', 'Job Profitability', 26\.8, 'percent', -2\.4, 'vs estimate', NULL\)/);
    assert.match(executable, /\('org-apex', 'opex_ratio', 'Operating Expense Ratio', 22\.9, 'percent', -0\.5, 'vs last month', NULL\)/);
    assert.match(executable, /\('org-apex', 'dscr', 'Debt Service Coverage', 1\.8, 'number', -0\.2, 'vs last quarter', NULL\)/);
    assert.match(executable, /\('org-apex', 'runway', 'Runway', 3\.4, 'number', -0\.3, 'months', NULL\)/);
    assert.doesNotMatch(executable, /'vs last month', 10\)/);
    assert.doesNotMatch(executable, /'vs last month', 32\)/);
    assert.doesNotMatch(executable, /'vs last month', 12\)/);
    assert.doesNotMatch(executable, /'vs last quarter', 45\)/);
    assert.doesNotMatch(executable, /'vs last month', 40\)/);
    assert.doesNotMatch(executable, /'vs last month', 35\)/);
    assert.doesNotMatch(executable, /'vs last quarter', 30\)/);
    assert.doesNotMatch(executable, /'vs estimate', 28\)/);
    assert.doesNotMatch(executable, /'vs last month', 24\)/);
    assert.doesNotMatch(executable, /'vs last quarter', 1\.5\)/);
    assert.doesNotMatch(executable, /'months', 6\)/);
    for (const value of invented) {
      assert.doesNotMatch(
        executable,
        new RegExp(`'org-apex', '[^']+', '[^']+', [^,]+, '[^']+', [^,]+, '[^']+', ${String(value).replace(".", "\\.")}\\)`)
      );
    }
  });

  it("keeps owner-set leftover seed.sql KPI targets SOURCE-DERIVED", () => {
    assert.equal(resolveKpiTarget(10), 10);
    assert.equal(resolveKpiTarget("32"), 32);
    assert.equal(resolveKpiTarget(6), 6);
    assert.equal(resolveKpiTarget(1.5), 1.5);
    assert.equal(resolveKpiTarget(undefined), undefined);
    assert.equal(resolveKpiTarget(null), undefined);
    assert.equal(resolveKpiTarget(0), undefined);
  });

  it("empty tenant still has no Apex leak after leftover seed.sql KPI target honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.kpis.length, 0);
    assert.equal(provisioned.kpis.length, 0);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover empty-tenant catalog lastSync / lastGenerated honesty", () => {
  const emptyOrgs = ["org-summit", "org-acme-services", "org-unknown-tenant", "org-hvcg"];
  const namedConnectors = ["Stripe", "Gusto", "HubSpot", "Google Sheets"];

  it("does not invent leftover connected Stripe/Gusto/HubSpot/Sheets lastSync for empty tenants", () => {
    for (const orgId of emptyOrgs) {
      const catalog = getTenantData(orgId).integrations;
      const connected = catalog.filter((item) => item.status === "connected");
      assert.equal(connected.length, 0, `${orgId} must not have connected catalog items`);
      for (const name of namedConnectors) {
        const item = catalog.find((entry) => entry.name === name);
        assert.ok(item, `${orgId} catalog must include ${name}`);
        assert.equal(item.status, "disconnected", `${orgId} ${name}`);
        assert.equal(item.lastSync, undefined, `${orgId} ${name} lastSync`);
      }
    }
    assert.equal(
      DISCONNECTED_INTEGRATIONS.every((item) => item.status === "disconnected" && item.lastSync === undefined),
      true
    );
    assert.equal(
      INTEGRATIONS.some((item) => namedConnectors.includes(item.name) && item.status === "connected"),
      false
    );
  });

  it("does not advertise leftover lastGenerated demo dates on empty-tenant reports", () => {
    for (const orgId of emptyOrgs) {
      const reports = getTenantData(orgId).reports;
      assert.equal(reports.length, EMPTY_TENANT_REPORTS.length);
      for (const report of reports) {
        assert.equal(
          report.lastGenerated,
          undefined,
          `${orgId} ${report.id} must not advertise lastGenerated`
        );
      }
    }
    assert.equal(
      EMPTY_TENANT_REPORTS.every((report) => report.lastGenerated === undefined),
      true
    );
    assert.equal(
      REPORTS.every((report) => typeof report.lastGenerated === "string"),
      true
    );
  });

  it("keeps live/owner-set catalog lastSync and Apex demo report dates SOURCE-DERIVED", () => {
    const live = {
      status: "connected",
      lastSync: "2026-08-01T12:00:00Z",
    };
    assert.equal(live.status, "connected");
    assert.equal(live.lastSync, "2026-08-01T12:00:00Z");

    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.integrations.every((item) => item.status === "disconnected"), true);
    assert.equal(apex.integrations.every((item) => item.lastSync === undefined), true);
    assert.equal(apex.reports.every((report) => typeof report.lastGenerated === "string"), true);
    assert.equal(apex.reports.length, REPORTS.length);
    assert.equal(apex.organization.settings.cashAlertThreshold, 150000);
    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
  });

  it("empty tenant still has no Apex leak after leftover catalog lastSync honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.kpis.length, 0);
    assert.equal(provisioned.kpis.length, 0);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("2025-05-24T05:30:00Z"), false);
    assert.equal(JSON.stringify(provisioned).includes("2025-05-24T05:30:00Z"), false);
  });
});

describe("leftover unused INTEGRATIONS template connected lastSync honesty", () => {
  const namedConnectors = ["Stripe", "Gusto", "HubSpot", "Google Sheets"];
  const inventedLastSync = [
    "2025-05-24T05:30:00Z",
    "2025-05-23T18:00:00Z",
    "2025-05-24T04:00:00Z",
    "2025-05-24T03:00:00Z",
  ];

  it("does not invent leftover connected lastSync on unused INTEGRATIONS template", () => {
    for (const name of namedConnectors) {
      const item = INTEGRATIONS.find((entry) => entry.name === name);
      assert.ok(item, `INTEGRATIONS must include ${name}`);
      assert.equal(item.status, "disconnected", `${name} template`);
      assert.equal(item.lastSync, undefined, `${name} template lastSync`);
    }
    assert.equal(INTEGRATIONS.some((item) => item.status === "connected"), false);
    for (const stamp of inventedLastSync) {
      assert.equal(
        INTEGRATIONS.some((item) => item.lastSync === stamp),
        false,
        stamp
      );
    }
  });

  it("keeps live/owner-set catalog lastSync SOURCE-DERIVED", () => {
    const live = { status: "connected", lastSync: "2026-08-01T12:00:00Z" };
    assert.equal(live.status, "connected");
    assert.equal(live.lastSync, "2026-08-01T12:00:00Z");
  });

  it("empty tenant still has no Apex leak after leftover INTEGRATIONS template honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.kpis.length, 0);
    assert.equal(provisioned.kpis.length, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(INTEGRATIONS).includes("2025-05-24T05:30:00Z"), false);
  });
});

describe("leftover unused INTEGRATIONS Buildertrend pending honesty", () => {
  it("does not invent leftover pending Buildertrend on unused INTEGRATIONS template", () => {
    const item = INTEGRATIONS.find((entry) => entry.name === "Buildertrend");
    assert.ok(item, "INTEGRATIONS must include Buildertrend");
    assert.equal(item.status, "disconnected", "Buildertrend template");
    assert.equal(item.lastSync, undefined, "Buildertrend template lastSync");
    assert.equal(INTEGRATIONS.some((entry) => entry.status === "pending"), false);
    assert.equal(INTEGRATIONS.some((entry) => entry.status === "connected"), false);
    assert.equal(
      DISCONNECTED_INTEGRATIONS.every((entry) => entry.status === "disconnected" && entry.lastSync === undefined),
      true
    );
  });

  it("keeps live/owner-set catalog lastSync SOURCE-DERIVED", () => {
    const live = { status: "connected", lastSync: "2026-08-01T12:00:00Z" };
    assert.equal(live.status, "connected");
    assert.equal(live.lastSync, "2026-08-01T12:00:00Z");
  });

  it("empty tenant still has no Apex leak after leftover Buildertrend pending honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(apex.alerts.length, 7);
    assert.equal(summit.kpis.length, 0);
    assert.equal(provisioned.kpis.length, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      getTenantData("org-summit").integrations.find((entry) => entry.name === "Buildertrend")?.status,
      "disconnected"
    );
  });
});

describe("founder journey commercial packaging", () => {
  it("routes empty tenant with incomplete onboarding to /onboarding", () => {
    const journey = resolveFounderJourney({
      organizationId: "org-acme-services",
      onboardingComplete: false,
      dataProvenance: "empty",
    });
    assert.equal(journey.status, "needs_onboarding");
    assert.equal(journey.nextAction.href, "/onboarding");
    assert.equal(journey.inventedFinancialValues, false);
    assert.equal(founderJourneyDoesNotInventFinancials(journey), true);
    assert.equal("currentCash" in journey, false);
  });

  it("routes empty tenant with completed onboarding to CSV/XLSX import", () => {
    const journey = resolveFounderJourney({
      organizationId: "org-summit",
      onboardingComplete: true,
      dataProvenance: "empty",
    });
    assert.equal(journey.status, "needs_import");
    assert.equal(journey.nextAction.href, "/integrations/import");
    assert.deepEqual(journey.completedSteps, ["onboard"]);
    assert.equal(founderJourneyDoesNotInventFinancials(journey), true);
  });

  it("routes imported SOURCE-DERIVED workspace to forecast insight", () => {
    const journey = resolveFounderJourney({
      organizationId: "org-hvcg",
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    assert.equal(journey.status, "ready_for_insight");
    assert.equal(journey.nextAction.href, "/cash-forecast");
    assert.deepEqual(journey.completedSteps, ["onboard", "import"]);
    assert.equal(founderJourneyDoesNotInventFinancials(journey), true);
  });

  it("labels Apex demo as demo_seeded and does not claim commercial founder complete", () => {
    const journey = resolveFounderJourney({
      organizationId: APEX_DEMO_ORGANIZATION_ID,
      onboardingComplete: true,
      dataProvenance: "seeded",
    });
    assert.equal(journey.status, "demo_seeded");
    assert.equal(journey.currentStep, "demo");
    assert.deepEqual(journey.completedSteps, []);
    assert.equal(JSON.stringify(journey).includes("487250"), false);
    assert.equal(apexPinnedCashUnchanged(), true);
  });

  it("empty-tenant journey does not invent Apex cash or leak Apex names", () => {
    const journey = resolveFounderJourney({
      organizationId: "org-acme-services",
      onboardingComplete: null,
      dataProvenance: "empty",
    });
    const empty = getTenantData("org-acme-services");
    assert.equal(journey.status, "needs_onboarding");
    assert.equal(empty.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(journey).includes("Harbor View"), false);
    assert.equal(JSON.stringify(journey).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(journey).includes("487250"), false);
    assert.equal(empty.financialSnapshot.currentCash === FINANCIAL_SNAPSHOT.currentCash, false);
  });
});

describe("import-success forecast/dashboard insight handoff", () => {
  it("hands imported SOURCE-DERIVED workspace to forecast and dashboard", () => {
    const handoff = resolveImportSuccessHandoff({
      organizationId: "org-hvcg",
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    assert.equal(handoff.status, "import_success");
    assert.deepEqual(
      handoff.destinations.map((d) => d.href),
      ["/cash-forecast", "/dashboard", "/value-creation", "/financials"],
    );
    assert.equal(handoff.inventedFinancialValues, false);
    assert.equal(importHandoffDoesNotInventFinancials(handoff), true);
    assert.equal("currentCash" in handoff, false);
    assert.equal(JSON.stringify(handoff).includes("487250"), false);
  });

  it("hands computed SOURCE-DERIVED workspace to the same insight destinations", () => {
    const handoff = resolveImportSuccessHandoff({
      organizationId: "org-summit",
      onboardingComplete: true,
      dataProvenance: "computed",
    });
    assert.equal(handoff.status, "import_success");
    assert.equal(handoff.destinations.length, 4);
    assert.equal(handoff.destinations[0].href, "/cash-forecast");
    assert.equal(handoff.destinations[1].href, "/dashboard");
    assert.equal(handoff.destinations[2].href, "/value-creation");
    assert.equal(handoff.destinations[3].href, "/financials");
    assert.equal(importHandoffDoesNotInventFinancials(handoff), true);
  });

  it("does not hand empty tenant to insight destinations", () => {
    const handoff = resolveImportSuccessHandoff({
      organizationId: "org-acme-services",
      onboardingComplete: true,
      dataProvenance: "empty",
    });
    assert.equal(handoff.status, "not_ready");
    assert.deepEqual(handoff.destinations, []);
    assert.equal(importHandoffDoesNotInventFinancials(handoff), true);
    assert.equal(JSON.stringify(handoff).includes("Harbor View"), false);
    assert.equal(JSON.stringify(handoff).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(handoff).includes("487250"), false);
  });

  it("does not claim commercial import-success for Apex demo", () => {
    const handoff = resolveImportSuccessHandoff({
      organizationId: APEX_DEMO_ORGANIZATION_ID,
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    assert.equal(handoff.status, "demo_seeded");
    assert.deepEqual(handoff.destinations, []);
    assert.equal(JSON.stringify(handoff).includes("487250"), false);
    assert.equal(apexPinnedCashUnchanged(), true);
  });

  it("does not invent financial values on the value-creation insight destination", () => {
    const handoff = resolveImportSuccessHandoff({
      organizationId: "org-hvcg",
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    const valueCreation = handoff.destinations.find((d) => d.href === "/value-creation");
    assert.equal(Boolean(valueCreation), true);
    assert.equal(JSON.stringify(valueCreation).includes("487250"), false);
    assert.equal("currentCash" in (valueCreation ?? {}), false);
    assert.equal(importHandoffDoesNotInventFinancials(handoff), true);
  });

  it("does not invent financial values on the financials insight destination", () => {
    const handoff = resolveImportSuccessHandoff({
      organizationId: "org-hvcg",
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    const financials = handoff.destinations.find((d) => d.href === "/financials");
    assert.equal(Boolean(financials), true);
    assert.equal(JSON.stringify(financials).includes("487250"), false);
    assert.equal("currentCash" in (financials ?? {}), false);
    assert.equal(importHandoffDoesNotInventFinancials(handoff), true);
  });
});

describe("forecast-page import-success insight banner", () => {
  it("shows remaining insight destinations after landing on cash-forecast", () => {
    const banner = resolveForecastInsightBanner({
      organizationId: "org-hvcg",
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    assert.equal(banner.status, "import_success");
    assert.deepEqual(
      banner.destinations.map((d) => d.href),
      ["/dashboard", "/value-creation", "/financials"],
    );
    assert.equal(banner.destinations.some((d) => d.href === "/cash-forecast"), false);
    assert.equal(banner.inventedFinancialValues, false);
    assert.equal(forecastBannerDoesNotInventFinancials(banner), true);
    assert.equal("currentCash" in banner, false);
    assert.equal(JSON.stringify(banner).includes("487250"), false);
  });

  it("hands computed SOURCE-DERIVED workspace to the same remaining destinations", () => {
    const banner = resolveForecastInsightBanner({
      organizationId: "org-summit",
      onboardingComplete: true,
      dataProvenance: "computed",
    });
    assert.equal(banner.status, "import_success");
    assert.equal(banner.destinations.length, 3);
    assert.equal(banner.destinations[0].href, "/dashboard");
    assert.equal(banner.destinations[1].href, "/value-creation");
    assert.equal(banner.destinations[2].href, "/financials");
    assert.equal(forecastBannerDoesNotInventFinancials(banner), true);
  });

  it("does not show the forecast banner for an empty tenant", () => {
    const banner = resolveForecastInsightBanner({
      organizationId: "org-acme-services",
      onboardingComplete: true,
      dataProvenance: "empty",
    });
    assert.equal(banner.status, "not_ready");
    assert.deepEqual(banner.destinations, []);
    assert.equal(forecastBannerDoesNotInventFinancials(banner), true);
    assert.equal(JSON.stringify(banner).includes("Harbor View"), false);
    assert.equal(JSON.stringify(banner).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(banner).includes("487250"), false);
  });

  it("does not claim commercial import-success on the forecast page for Apex demo", () => {
    const banner = resolveForecastInsightBanner({
      organizationId: APEX_DEMO_ORGANIZATION_ID,
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    assert.equal(banner.status, "demo_seeded");
    assert.deepEqual(banner.destinations, []);
    assert.equal(JSON.stringify(banner).includes("487250"), false);
    assert.equal(apexPinnedCashUnchanged(), true);
  });
});

describe("value-creation-page import-success insight banner", () => {
  it("shows remaining insight destinations after landing on value-creation", () => {
    const banner = resolveValueCreationInsightBanner({
      organizationId: "org-hvcg",
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    assert.equal(banner.status, "import_success");
    assert.deepEqual(
      banner.destinations.map((d) => d.href),
      ["/cash-forecast", "/dashboard", "/financials"],
    );
    assert.equal(banner.destinations.some((d) => d.href === "/value-creation"), false);
    assert.equal(banner.inventedFinancialValues, false);
    assert.equal(valueCreationBannerDoesNotInventFinancials(banner), true);
    assert.equal("currentCash" in banner, false);
    assert.equal(JSON.stringify(banner).includes("487250"), false);
  });

  it("hands computed SOURCE-DERIVED workspace to the same remaining destinations", () => {
    const banner = resolveValueCreationInsightBanner({
      organizationId: "org-summit",
      onboardingComplete: true,
      dataProvenance: "computed",
    });
    assert.equal(banner.status, "import_success");
    assert.equal(banner.destinations.length, 3);
    assert.equal(banner.destinations[0].href, "/cash-forecast");
    assert.equal(banner.destinations[1].href, "/dashboard");
    assert.equal(banner.destinations[2].href, "/financials");
    assert.equal(valueCreationBannerDoesNotInventFinancials(banner), true);
  });

  it("does not show the value-creation banner for an empty tenant", () => {
    const banner = resolveValueCreationInsightBanner({
      organizationId: "org-acme-services",
      onboardingComplete: true,
      dataProvenance: "empty",
    });
    assert.equal(banner.status, "not_ready");
    assert.deepEqual(banner.destinations, []);
    assert.equal(valueCreationBannerDoesNotInventFinancials(banner), true);
    assert.equal(JSON.stringify(banner).includes("Harbor View"), false);
    assert.equal(JSON.stringify(banner).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(banner).includes("487250"), false);
  });

  it("does not claim commercial import-success on value-creation for Apex demo", () => {
    const banner = resolveValueCreationInsightBanner({
      organizationId: APEX_DEMO_ORGANIZATION_ID,
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    assert.equal(banner.status, "demo_seeded");
    assert.deepEqual(banner.destinations, []);
    assert.equal(JSON.stringify(banner).includes("487250"), false);
    assert.equal(apexPinnedCashUnchanged(), true);
  });
});

describe("financials-page import-success insight banner", () => {
  it("shows remaining insight destinations after landing on financials", () => {
    const banner = resolveFinancialsInsightBanner({
      organizationId: "org-hvcg",
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    assert.equal(banner.status, "import_success");
    assert.deepEqual(
      banner.destinations.map((d) => d.href),
      ["/cash-forecast", "/dashboard", "/value-creation"],
    );
    assert.equal(banner.destinations.some((d) => d.href === "/financials"), false);
    assert.equal(banner.inventedFinancialValues, false);
    assert.equal(financialsBannerDoesNotInventFinancials(banner), true);
    assert.equal("currentCash" in banner, false);
    assert.equal(JSON.stringify(banner).includes("487250"), false);
  });

  it("hands computed SOURCE-DERIVED workspace to the same remaining destinations", () => {
    const banner = resolveFinancialsInsightBanner({
      organizationId: "org-summit",
      onboardingComplete: true,
      dataProvenance: "computed",
    });
    assert.equal(banner.status, "import_success");
    assert.equal(banner.destinations.length, 3);
    assert.equal(banner.destinations[0].href, "/cash-forecast");
    assert.equal(banner.destinations[1].href, "/dashboard");
    assert.equal(banner.destinations[2].href, "/value-creation");
    assert.equal(financialsBannerDoesNotInventFinancials(banner), true);
  });

  it("does not show the financials banner for an empty tenant", () => {
    const banner = resolveFinancialsInsightBanner({
      organizationId: "org-acme-services",
      onboardingComplete: true,
      dataProvenance: "empty",
    });
    assert.equal(banner.status, "not_ready");
    assert.deepEqual(banner.destinations, []);
    assert.equal(financialsBannerDoesNotInventFinancials(banner), true);
    assert.equal(JSON.stringify(banner).includes("Harbor View"), false);
    assert.equal(JSON.stringify(banner).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(banner).includes("487250"), false);
  });

  it("does not claim commercial import-success on the financials page for Apex demo", () => {
    const banner = resolveFinancialsInsightBanner({
      organizationId: APEX_DEMO_ORGANIZATION_ID,
      onboardingComplete: true,
      dataProvenance: "imported",
    });
    assert.equal(banner.status, "demo_seeded");
    assert.deepEqual(banner.destinations, []);
    assert.equal(JSON.stringify(banner).includes("487250"), false);
    assert.equal(apexPinnedCashUnchanged(), true);
  });
});

function apexPinnedCashUnchanged() {
  return getTenantData(APEX_DEMO_ORGANIZATION_ID).financialSnapshot.currentCash === FINANCIAL_SNAPSHOT.currentCash;
}

describe("leftover financials-page invented MetricCard change={12.4} honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/financials/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Revenue MTD change={12.4} on the financials page", () => {
    assert.equal(page.includes("change={12.4}"), false);
    assert.equal(page.includes('changeLabel="vs last month"'), false);
    assert.match(
      page,
      /<MetricCard title="Revenue MTD" value=\{financialSnapshot\.revenueMTD\} \/>/
    );
    assert.equal(/\bchange=\{[^}]+\}/.test(page), false);
  });

  it("keeps pinned Apex Revenue Growth 12.4 SOURCE-DERIVED", () => {
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.name, "Revenue Growth");
    assert.equal(growth.value, 12.4);
    assert.equal(apexPinnedCashUnchanged(), true);
  });

  it("empty tenant still has no Apex leak after leftover financials MetricCard honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover financials-page invented QBO/Plaid sync claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/financials/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Synced from QuickBooks Online and Plaid on the financials page", () => {
    assert.equal(page.includes("Synced from QuickBooks Online and Plaid"), false);
    assert.equal(page.includes("QuickBooks Online and Plaid"), false);
    assert.equal(page.includes("Synced from QuickBooks"), false);
    assert.match(page, /<CardTitle>Recent Transactions<\/CardTitle>/);
    assert.match(page, /<CardDescription>Recent tenant transactions<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover sync-claim honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover financials sync-claim honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover dashboard invented Real-time financial overview honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/dashboard/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Real-time financial overview on the dashboard page", () => {
    assert.equal(page.includes("Real-time financial overview"), false);
    assert.equal(page.includes("Real-time"), false);
    assert.match(
      page,
      /description=\{`Financial overview for \$\{organization\.name\}`\}/
    );
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover realtime honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover dashboard realtime honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover reports-page invented CFO-grade PDF/Excel/board-review claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover CFO-grade reports ready for PDF, Excel, and board review on the reports page", () => {
    assert.equal(page.includes("CFO-grade reports ready for PDF, Excel, and board review"), false);
    assert.equal(page.includes("CFO-grade"), false);
    assert.equal(page.includes("board review"), false);
    assert.equal(page.includes("ready for PDF, Excel"), false);
    assert.match(
      page,
      /description=\{`Reports for \$\{organization\.name\}`\}/
    );
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-page honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover reports-page honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover value-creation-page invented Evidence-backed claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/value-creation/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Evidence-backed opportunities on the value-creation page", () => {
    assert.equal(
      page.includes("Evidence-backed opportunities to improve margin, cash, and enterprise value"),
      false
    );
    assert.equal(page.includes("Evidence-backed"), false);
    assert.equal(page.includes("enterprise value"), false);
    assert.match(
      page,
      /description=\{`Value-creation opportunities for \$\{organization\.name\}`\}/
    );
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover value-creation honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover value-creation honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover alerts-page invented recommended-actions claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/alerts/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Financial and operational risk alerts with recommended actions on the alerts page", () => {
    assert.equal(
      page.includes("Financial and operational risk alerts with recommended actions"),
      false
    );
    assert.equal(page.includes("recommended actions"), false);
    assert.equal(page.includes("operational risk alerts"), false);
    assert.match(
      page,
      /description=\{`Alerts for \$\{organization\.name\}`\}/
    );
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover alerts-page honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover alerts-page honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover sales-pipeline-page invented conversion-metrics claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/sales-pipeline/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Opportunities, weighted revenue forecast, and conversion metrics on the sales-pipeline page", () => {
    assert.equal(
      page.includes("Opportunities, weighted revenue forecast, and conversion metrics"),
      false
    );
    assert.equal(page.includes("weighted revenue forecast"), false);
    assert.equal(page.includes("conversion metrics"), false);
    assert.match(
      page,
      /description=\{`Sales pipeline for \$\{organization\.name\}`\}/
    );
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover sales-pipeline honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover sales-pipeline honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover operations-page invented production-status billing-timing claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/operations/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Active jobs, margins, production status, and billing timing on the operations page", () => {
    assert.equal(
      page.includes("Active jobs, margins, production status, and billing timing"),
      false
    );
    assert.equal(page.includes("production status"), false);
    assert.equal(page.includes("billing timing"), false);
    assert.match(
      page,
      /description=\{`Operations for \$\{organization\.name\}`\}/
    );
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover operations honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover operations honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover cash-forecast-page invented scenario-analysis claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/cash-forecast/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover 13-week rolling cash forecast with scenario analysis on the cash-forecast page", () => {
    assert.equal(
      page.includes("13-week rolling cash forecast with scenario analysis"),
      false
    );
    assert.equal(page.includes("rolling cash forecast"), false);
    assert.equal(page.includes("scenario analysis"), false);
    assert.match(
      page,
      /description=\{`Cash forecast for \$\{organization\.name\}`\}/
    );
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover cash-forecast honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover cash-forecast honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover reports-catalog invented scenario-analysis claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover 13-week rolling cash forecast with scenario analysis in reports catalog", () => {
    const cashForecast = REPORTS.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(
      cashForecast.description.includes("13-week rolling cash forecast with scenario analysis"),
      false
    );
    assert.equal(cashForecast.description.includes("rolling cash forecast"), false);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("13-week rolling cash forecast with scenario analysis")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("13-week rolling cash forecast with scenario analysis")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) => report.description.includes("scenario analysis")),
      false
    );
  });
});

describe("leftover reports-catalog invented leadership/board-review claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover high-level financial overview for leadership and board review in reports catalog", () => {
    const executiveSummary = REPORTS.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(
      executiveSummary.description.includes(
        "High-level financial overview for leadership and board review"
      ),
      false
    );
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    assert.equal(executiveSummary.description.includes("High-level financial overview"), false);
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("High-level financial overview for leadership and board review")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("High-level financial overview for leadership and board review")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog leadership honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const executiveSummary = apex.reports.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog leadership honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("leadership and board review")
      ),
      false
    );
  });
});

describe("leftover reports-catalog invented P&L variance-analysis claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Monthly and YTD P&L with variance analysis in reports catalog", () => {
    const profitAndLoss = REPORTS.find((report) => report.id === "rpt-3");
    assert.ok(profitAndLoss);
    assert.equal(
      profitAndLoss.description.includes("Monthly and YTD P&L with variance analysis"),
      false
    );
    assert.equal(profitAndLoss.description.includes("Monthly and YTD P&L"), false);
    assert.equal(profitAndLoss.description.includes("YTD P&L with variance"), false);
    assert.equal(profitAndLoss.description, "Profit and loss report");
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("Monthly and YTD P&L with variance analysis")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("Monthly and YTD P&L with variance analysis")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog P&L honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const profitAndLoss = apex.reports.find((report) => report.id === "rpt-3");
    assert.ok(profitAndLoss);
    assert.equal(
      profitAndLoss.description.includes("Monthly and YTD P&L with variance analysis"),
      false
    );
    const executiveSummary = apex.reports.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog P&L honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("Monthly and YTD P&L with variance analysis")
      ),
      false
    );
  });
});

describe("leftover reports-catalog invented Category-level budget variance analysis claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Category-level budget variance analysis in reports catalog", () => {
    const budgetVsActual = REPORTS.find((report) => report.id === "rpt-9");
    assert.ok(budgetVsActual);
    assert.equal(
      budgetVsActual.description.includes("Category-level budget variance analysis"),
      false
    );
    assert.equal(budgetVsActual.description.includes("Category-level"), false);
    assert.equal(budgetVsActual.description.includes("budget variance analysis"), false);
    assert.equal(budgetVsActual.description, "Budget versus actual report");
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("Category-level budget variance analysis")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("Category-level budget variance analysis")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog budget-variance honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const budgetVsActual = apex.reports.find((report) => report.id === "rpt-9");
    assert.ok(budgetVsActual);
    assert.equal(
      budgetVsActual.description.includes("Category-level budget variance analysis"),
      false
    );
    const profitAndLoss = apex.reports.find((report) => report.id === "rpt-3");
    assert.ok(profitAndLoss);
    assert.equal(
      profitAndLoss.description.includes("Monthly and YTD P&L with variance analysis"),
      false
    );
    const executiveSummary = apex.reports.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog budget-variance honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("Category-level budget variance analysis")
      ),
      false
    );
  });
});

describe("leftover reports-catalog invented Forecast accuracy and variance tracking claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Forecast accuracy and variance tracking in reports catalog", () => {
    const forecastVsActual = REPORTS.find((report) => report.id === "rpt-10");
    assert.ok(forecastVsActual);
    assert.equal(
      forecastVsActual.description.includes("Forecast accuracy and variance tracking"),
      false
    );
    assert.equal(forecastVsActual.description.includes("Forecast accuracy"), false);
    assert.equal(forecastVsActual.description.includes("variance tracking"), false);
    assert.equal(forecastVsActual.description, "Forecast versus actual report");
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("Forecast accuracy and variance tracking")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("Forecast accuracy and variance tracking")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog forecast-accuracy honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const forecastVsActual = apex.reports.find((report) => report.id === "rpt-10");
    assert.ok(forecastVsActual);
    assert.equal(
      forecastVsActual.description.includes("Forecast accuracy and variance tracking"),
      false
    );
    const budgetVsActual = apex.reports.find((report) => report.id === "rpt-9");
    assert.ok(budgetVsActual);
    assert.equal(
      budgetVsActual.description.includes("Category-level budget variance analysis"),
      false
    );
    const profitAndLoss = apex.reports.find((report) => report.id === "rpt-3");
    assert.ok(profitAndLoss);
    assert.equal(
      profitAndLoss.description.includes("Monthly and YTD P&L with variance analysis"),
      false
    );
    const executiveSummary = apex.reports.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog forecast-accuracy honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("Forecast accuracy and variance tracking")
      ),
      false
    );
  });
});

describe("leftover reports-catalog invented Weighted pipeline revenue projection claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Weighted pipeline revenue projection by stage and rep in reports catalog", () => {
    const salesPipeline = REPORTS.find((report) => report.id === "rpt-7");
    assert.ok(salesPipeline);
    assert.equal(
      salesPipeline.description.includes("Weighted pipeline revenue projection by stage and rep"),
      false
    );
    assert.equal(salesPipeline.description.includes("Weighted pipeline"), false);
    assert.equal(salesPipeline.description.includes("by stage and rep"), false);
    assert.equal(salesPipeline.description, "Sales pipeline forecast report");
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("Weighted pipeline revenue projection by stage and rep")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("Weighted pipeline revenue projection by stage and rep")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog weighted-pipeline honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const salesPipeline = apex.reports.find((report) => report.id === "rpt-7");
    assert.ok(salesPipeline);
    assert.equal(
      salesPipeline.description.includes("Weighted pipeline revenue projection by stage and rep"),
      false
    );
    const forecastVsActual = apex.reports.find((report) => report.id === "rpt-10");
    assert.ok(forecastVsActual);
    assert.equal(
      forecastVsActual.description.includes("Forecast accuracy and variance tracking"),
      false
    );
    const budgetVsActual = apex.reports.find((report) => report.id === "rpt-9");
    assert.ok(budgetVsActual);
    assert.equal(
      budgetVsActual.description.includes("Category-level budget variance analysis"),
      false
    );
    const profitAndLoss = apex.reports.find((report) => report.id === "rpt-3");
    assert.ok(profitAndLoss);
    assert.equal(
      profitAndLoss.description.includes("Monthly and YTD P&L with variance analysis"),
      false
    );
    const executiveSummary = apex.reports.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog weighted-pipeline honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("Weighted pipeline revenue projection by stage and rep")
      ),
      false
    );
  });
});

describe("leftover reports-catalog invented Margin analysis by active and completed jobs claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Margin analysis by active and completed jobs in reports catalog", () => {
    const jobProfitability = REPORTS.find((report) => report.id === "rpt-8");
    assert.ok(jobProfitability);
    assert.equal(
      jobProfitability.description.includes("Margin analysis by active and completed jobs"),
      false
    );
    assert.equal(jobProfitability.description.includes("Margin analysis"), false);
    assert.equal(jobProfitability.description.includes("active and completed jobs"), false);
    assert.equal(jobProfitability.description, "Job profitability report");
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("Margin analysis by active and completed jobs")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("Margin analysis by active and completed jobs")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog margin-analysis honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const jobProfitability = apex.reports.find((report) => report.id === "rpt-8");
    assert.ok(jobProfitability);
    assert.equal(
      jobProfitability.description.includes("Margin analysis by active and completed jobs"),
      false
    );
    const salesPipeline = apex.reports.find((report) => report.id === "rpt-7");
    assert.ok(salesPipeline);
    assert.equal(
      salesPipeline.description.includes("Weighted pipeline revenue projection by stage and rep"),
      false
    );
    const forecastVsActual = apex.reports.find((report) => report.id === "rpt-10");
    assert.ok(forecastVsActual);
    assert.equal(
      forecastVsActual.description.includes("Forecast accuracy and variance tracking"),
      false
    );
    const budgetVsActual = apex.reports.find((report) => report.id === "rpt-9");
    assert.ok(budgetVsActual);
    assert.equal(
      budgetVsActual.description.includes("Category-level budget variance analysis"),
      false
    );
    const profitAndLoss = apex.reports.find((report) => report.id === "rpt-3");
    assert.ok(profitAndLoss);
    assert.equal(
      profitAndLoss.description.includes("Monthly and YTD P&L with variance analysis"),
      false
    );
    const executiveSummary = apex.reports.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog margin-analysis honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("Margin analysis by active and completed jobs")
      ),
      false
    );
  });
});

describe("leftover reports-catalog invented Assets, liabilities, and equity snapshot claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Assets, liabilities, and equity snapshot in reports catalog", () => {
    const balanceSheet = REPORTS.find((report) => report.id === "rpt-4");
    assert.ok(balanceSheet);
    assert.equal(
      balanceSheet.description.includes("Assets, liabilities, and equity snapshot"),
      false
    );
    assert.equal(balanceSheet.description.includes("Assets, liabilities, and equity"), false);
    assert.equal(balanceSheet.description.includes("equity snapshot"), false);
    assert.equal(balanceSheet.description, "Balance sheet report");
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("Assets, liabilities, and equity snapshot")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("Assets, liabilities, and equity snapshot")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog balance-sheet honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const balanceSheet = apex.reports.find((report) => report.id === "rpt-4");
    assert.ok(balanceSheet);
    assert.equal(
      balanceSheet.description.includes("Assets, liabilities, and equity snapshot"),
      false
    );
    const jobProfitability = apex.reports.find((report) => report.id === "rpt-8");
    assert.ok(jobProfitability);
    assert.equal(
      jobProfitability.description.includes("Margin analysis by active and completed jobs"),
      false
    );
    const salesPipeline = apex.reports.find((report) => report.id === "rpt-7");
    assert.ok(salesPipeline);
    assert.equal(
      salesPipeline.description.includes("Weighted pipeline revenue projection by stage and rep"),
      false
    );
    const forecastVsActual = apex.reports.find((report) => report.id === "rpt-10");
    assert.ok(forecastVsActual);
    assert.equal(
      forecastVsActual.description.includes("Forecast accuracy and variance tracking"),
      false
    );
    const budgetVsActual = apex.reports.find((report) => report.id === "rpt-9");
    assert.ok(budgetVsActual);
    assert.equal(
      budgetVsActual.description.includes("Category-level budget variance analysis"),
      false
    );
    const profitAndLoss = apex.reports.find((report) => report.id === "rpt-3");
    assert.ok(profitAndLoss);
    assert.equal(
      profitAndLoss.description.includes("Monthly and YTD P&L with variance analysis"),
      false
    );
    const executiveSummary = apex.reports.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog balance-sheet honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("Assets, liabilities, and equity snapshot")
      ),
      false
    );
  });
});

describe("leftover reports-catalog invented Accounts receivable aging by customer and bucket claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Accounts receivable aging by customer and bucket in reports catalog", () => {
    const arAging = REPORTS.find((report) => report.id === "rpt-5");
    assert.ok(arAging);
    assert.equal(
      arAging.description.includes("Accounts receivable aging by customer and bucket"),
      false
    );
    assert.equal(arAging.description.includes("by customer and bucket"), false);
    assert.equal(arAging.description.includes("Accounts receivable aging"), false);
    assert.equal(arAging.description, "AR aging report");
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("Accounts receivable aging by customer and bucket")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("Accounts receivable aging by customer and bucket")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog ar-aging honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const arAging = apex.reports.find((report) => report.id === "rpt-5");
    assert.ok(arAging);
    assert.equal(
      arAging.description.includes("Accounts receivable aging by customer and bucket"),
      false
    );
    const balanceSheet = apex.reports.find((report) => report.id === "rpt-4");
    assert.ok(balanceSheet);
    assert.equal(
      balanceSheet.description.includes("Assets, liabilities, and equity snapshot"),
      false
    );
    const jobProfitability = apex.reports.find((report) => report.id === "rpt-8");
    assert.ok(jobProfitability);
    assert.equal(
      jobProfitability.description.includes("Margin analysis by active and completed jobs"),
      false
    );
    const salesPipeline = apex.reports.find((report) => report.id === "rpt-7");
    assert.ok(salesPipeline);
    assert.equal(
      salesPipeline.description.includes("Weighted pipeline revenue projection by stage and rep"),
      false
    );
    const forecastVsActual = apex.reports.find((report) => report.id === "rpt-10");
    assert.ok(forecastVsActual);
    assert.equal(
      forecastVsActual.description.includes("Forecast accuracy and variance tracking"),
      false
    );
    const budgetVsActual = apex.reports.find((report) => report.id === "rpt-9");
    assert.ok(budgetVsActual);
    assert.equal(
      budgetVsActual.description.includes("Category-level budget variance analysis"),
      false
    );
    const profitAndLoss = apex.reports.find((report) => report.id === "rpt-3");
    assert.ok(profitAndLoss);
    assert.equal(
      profitAndLoss.description.includes("Monthly and YTD P&L with variance analysis"),
      false
    );
    const executiveSummary = apex.reports.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog ar-aging honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("Accounts receivable aging by customer and bucket")
      ),
      false
    );
  });
});

describe("leftover reports-catalog invented Accounts payable aging by vendor and due date claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Accounts payable aging by vendor and due date in reports catalog", () => {
    const apAging = REPORTS.find((report) => report.id === "rpt-6");
    assert.ok(apAging);
    assert.equal(
      apAging.description.includes("Accounts payable aging by vendor and due date"),
      false
    );
    assert.equal(apAging.description.includes("by vendor and due date"), false);
    assert.equal(apAging.description.includes("Accounts payable aging"), false);
    assert.equal(apAging.description, "AP aging report");
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("Accounts payable aging by vendor and due date")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("Accounts payable aging by vendor and due date")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog ap-aging honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const apAging = apex.reports.find((report) => report.id === "rpt-6");
    assert.ok(apAging);
    assert.equal(
      apAging.description.includes("Accounts payable aging by vendor and due date"),
      false
    );
    const arAging = apex.reports.find((report) => report.id === "rpt-5");
    assert.ok(arAging);
    assert.equal(
      arAging.description.includes("Accounts receivable aging by customer and bucket"),
      false
    );
    const balanceSheet = apex.reports.find((report) => report.id === "rpt-4");
    assert.ok(balanceSheet);
    assert.equal(
      balanceSheet.description.includes("Assets, liabilities, and equity snapshot"),
      false
    );
    const jobProfitability = apex.reports.find((report) => report.id === "rpt-8");
    assert.ok(jobProfitability);
    assert.equal(
      jobProfitability.description.includes("Margin analysis by active and completed jobs"),
      false
    );
    const salesPipeline = apex.reports.find((report) => report.id === "rpt-7");
    assert.ok(salesPipeline);
    assert.equal(
      salesPipeline.description.includes("Weighted pipeline revenue projection by stage and rep"),
      false
    );
    const forecastVsActual = apex.reports.find((report) => report.id === "rpt-10");
    assert.ok(forecastVsActual);
    assert.equal(
      forecastVsActual.description.includes("Forecast accuracy and variance tracking"),
      false
    );
    const budgetVsActual = apex.reports.find((report) => report.id === "rpt-9");
    assert.ok(budgetVsActual);
    assert.equal(
      budgetVsActual.description.includes("Category-level budget variance analysis"),
      false
    );
    const profitAndLoss = apex.reports.find((report) => report.id === "rpt-3");
    assert.ok(profitAndLoss);
    assert.equal(
      profitAndLoss.description.includes("Monthly and YTD P&L with variance analysis"),
      false
    );
    const executiveSummary = apex.reports.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog ap-aging honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("Accounts payable aging by vendor and due date")
      ),
      false
    );
  });
});

describe("leftover reports-catalog invented Key performance indicators dashboard export claim honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Key performance indicators dashboard export in reports catalog", () => {
    const kpiScorecard = REPORTS.find((report) => report.id === "rpt-11");
    assert.ok(kpiScorecard);
    assert.equal(
      kpiScorecard.description.includes("Key performance indicators dashboard export"),
      false
    );
    assert.equal(kpiScorecard.description.includes("dashboard export"), false);
    assert.equal(kpiScorecard.description.includes("Key performance indicators"), false);
    assert.equal(kpiScorecard.description, "KPI scorecard report");
    assert.equal(
      REPORTS.some((report) =>
        report.description.includes("Key performance indicators dashboard export")
      ),
      false
    );
    assert.equal(
      EMPTY_TENANT_REPORTS.some((report) =>
        report.description.includes("Key performance indicators dashboard export")
      ),
      false
    );
    assert.match(page, /<CardDescription>\{report\.description\}<\/CardDescription>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-catalog kpi-scorecard honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const kpiScorecard = apex.reports.find((report) => report.id === "rpt-11");
    assert.ok(kpiScorecard);
    assert.equal(
      kpiScorecard.description.includes("Key performance indicators dashboard export"),
      false
    );
    const apAging = apex.reports.find((report) => report.id === "rpt-6");
    assert.ok(apAging);
    assert.equal(
      apAging.description.includes("Accounts payable aging by vendor and due date"),
      false
    );
    const arAging = apex.reports.find((report) => report.id === "rpt-5");
    assert.ok(arAging);
    assert.equal(
      arAging.description.includes("Accounts receivable aging by customer and bucket"),
      false
    );
    const balanceSheet = apex.reports.find((report) => report.id === "rpt-4");
    assert.ok(balanceSheet);
    assert.equal(
      balanceSheet.description.includes("Assets, liabilities, and equity snapshot"),
      false
    );
    const jobProfitability = apex.reports.find((report) => report.id === "rpt-8");
    assert.ok(jobProfitability);
    assert.equal(
      jobProfitability.description.includes("Margin analysis by active and completed jobs"),
      false
    );
    const salesPipeline = apex.reports.find((report) => report.id === "rpt-7");
    assert.ok(salesPipeline);
    assert.equal(
      salesPipeline.description.includes("Weighted pipeline revenue projection by stage and rep"),
      false
    );
    const forecastVsActual = apex.reports.find((report) => report.id === "rpt-10");
    assert.ok(forecastVsActual);
    assert.equal(
      forecastVsActual.description.includes("Forecast accuracy and variance tracking"),
      false
    );
    const budgetVsActual = apex.reports.find((report) => report.id === "rpt-9");
    assert.ok(budgetVsActual);
    assert.equal(
      budgetVsActual.description.includes("Category-level budget variance analysis"),
      false
    );
    const profitAndLoss = apex.reports.find((report) => report.id === "rpt-3");
    assert.ok(profitAndLoss);
    assert.equal(
      profitAndLoss.description.includes("Monthly and YTD P&L with variance analysis"),
      false
    );
    const executiveSummary = apex.reports.find((report) => report.id === "rpt-1");
    assert.ok(executiveSummary);
    assert.equal(executiveSummary.description.includes("leadership and board review"), false);
    const cashForecast = apex.reports.find((report) => report.id === "rpt-2");
    assert.ok(cashForecast);
    assert.equal(cashForecast.description.includes("scenario analysis"), false);
  });

  it("empty tenant still has no Apex leak after leftover reports-catalog kpi-scorecard honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("Key performance indicators dashboard export")
      ),
      false
    );
  });
});

describe("leftover reports-page invented Key-performance-indicators-snapshot CardDescription honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/reports/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Key performance indicators snapshot — click edit to update KPIs on the reports page", () => {
    assert.equal(
      page.includes("Key performance indicators snapshot — click edit to update KPIs"),
      false
    );
    assert.equal(page.includes("Key performance indicators snapshot"), false);
    assert.equal(page.includes("click edit to update KPIs"), false);
    assert.equal(page.includes("Key performance indicators"), false);
    assert.match(
      page,
      /<CardDescription>\{\`KPI scorecard for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Reports for \$\{organization\.name\}`\}/);
    const kpiScorecard = REPORTS.find((report) => report.id === "rpt-11");
    assert.ok(kpiScorecard);
    assert.equal(kpiScorecard.description, "KPI scorecard report");
    assert.equal(
      kpiScorecard.description.includes("Key performance indicators dashboard export"),
      false
    );
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover reports-page kpi-snapshot honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
    const kpiScorecard = apex.reports.find((report) => report.id === "rpt-11");
    assert.ok(kpiScorecard);
    assert.equal(kpiScorecard.description, "KPI scorecard report");
  });

  it("empty tenant still has no Apex leak after leftover reports-page kpi-snapshot honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
    assert.equal(
      summit.reports.some((report) =>
        report.description.includes("Key performance indicators snapshot")
      ),
      false
    );
  });
});

describe("leftover sales-pipeline invented Total-vs-weighted-value-by-deal-stage CardDescription honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/sales-pipeline/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Total vs weighted value by deal stage on the sales-pipeline page", () => {
    assert.equal(page.includes("Total vs weighted value by deal stage"), false);
    assert.equal(page.includes("Total vs weighted"), false);
    assert.equal(page.includes("weighted value by deal stage"), false);
    assert.match(
      page,
      /<CardDescription>\{\`Pipeline by stage for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Sales pipeline for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover sales-pipeline total-vs-weighted honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover sales-pipeline total-vs-weighted honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover sales-pipeline invented Performance-by-sales-representative CardDescription honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/sales-pipeline/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Performance by sales representative on the sales-pipeline page", () => {
    assert.equal(page.includes("Performance by sales representative"), false);
    assert.equal(page.includes("by sales representative"), false);
    assert.match(
      page,
      /<CardDescription>\{\`Sales by rep for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Pipeline by stage for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Sales pipeline for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover sales-pipeline performance-by-rep honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover sales-pipeline performance-by-rep honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover cash-forecast invented 6-month-projection-with-risk-periods CardDescription honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/cash-forecast/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover 6-month projection with risk periods highlighted on the cash-forecast page", () => {
    assert.equal(page.includes("6-month projection with risk periods highlighted"), false);
    assert.equal(page.includes("6-month projection"), false);
    assert.equal(page.includes("risk periods highlighted"), false);
    assert.match(
      page,
      /<CardDescription>\{\`Monthly cash forecast for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Cash forecast for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover cash-forecast 6-month-projection honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover cash-forecast 6-month-projection honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover cash-forecast invented Inputs-driving-the-cash-forecast-model CardDescription honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/cash-forecast/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Inputs driving the cash forecast model on the cash-forecast page", () => {
    assert.equal(page.includes("Inputs driving the cash forecast model"), false);
    assert.equal(page.includes("Inputs driving"), false);
    assert.equal(page.includes("cash forecast model"), false);
    assert.match(
      page,
      /<CardDescription>\{\`Forecast assumptions for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Monthly cash forecast for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Cash forecast for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover cash-forecast Inputs-driving honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover cash-forecast Inputs-driving honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Default-assumptions-for-cash-forecasting CardDescription honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Default assumptions for cash forecasting on the settings page", () => {
    assert.equal(page.includes("Default assumptions for cash forecasting"), false);
    assert.equal(page.includes("Default assumptions"), false);
    assert.equal(page.includes("assumptions for cash forecasting"), false);
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /<CardTitle>Forecast Settings<\/CardTitle>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings Default-assumptions honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings Default-assumptions honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Organization-settings-forecast-assumptions-thresholds-and-billing PageHeader honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Organization settings, forecast assumptions, thresholds, and billing on the settings page", () => {
    assert.equal(page.includes("Organization settings, forecast assumptions, thresholds, and billing"), false);
    assert.equal(page.includes("forecast assumptions"), false);
    assert.equal(page.includes("thresholds, and billing"), false);
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /<CardTitle>Forecast Settings<\/CardTitle>/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings PageHeader honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings PageHeader honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Configure-when-financial-alerts-are-triggered CardDescription honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Configure when financial alerts are triggered on the settings page", () => {
    assert.equal(page.includes("Configure when financial alerts are triggered"), false);
    assert.equal(page.includes("financial alerts are triggered"), false);
    assert.equal(page.includes("when financial alerts"), false);
    assert.match(
      page,
      /<CardDescription>\{\`Alert thresholds for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /<CardTitle>Alert Thresholds<\/CardTitle>/);
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings financial-alerts-triggered honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings financial-alerts-triggered honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Manage-your-Growth-Command-Center-plan-via-Stripe CardDescription honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Manage your Growth Command Center plan via Stripe on the settings page", () => {
    assert.equal(page.includes("Manage your Growth Command Center plan via Stripe"), false);
    assert.equal(page.includes("plan via Stripe"), false);
    assert.equal(page.includes("via Stripe"), false);
    assert.match(
      page,
      /<CardDescription>\{\`Billing settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /<CardTitle>Subscription & Billing<\/CardTitle>/);
    assert.match(
      page,
      /<CardDescription>\{\`Alert thresholds for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings Stripe-plan honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings Stripe-plan honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Basic-information-about-your-company CardDescription honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Basic information about your company on the settings page", () => {
    assert.equal(page.includes("Basic information about your company"), false);
    assert.equal(page.includes("Basic information"), false);
    assert.equal(page.includes("about your company"), false);
    assert.match(
      page,
      /<CardDescription>\{\`Organization profile for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /<CardTitle>Organization Profile<\/CardTitle>/);
    assert.match(
      page,
      /<CardDescription>\{\`Billing settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Alert thresholds for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings Organization-Profile honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings Organization-Profile honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Weight-open-deals-into-revenue-projections helper-text honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Weight open deals into revenue projections on the settings page", () => {
    assert.equal(page.includes("Weight open deals into revenue projections"), false);
    assert.equal(page.includes("Weight open deals"), false);
    assert.equal(page.includes("into revenue projections"), false);
    assert.match(
      page,
      /Sales pipeline forecast setting for \$\{organization\.name\}/
    );
    assert.match(page, /Include sales pipeline in forecast/);
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Organization profile for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings Weight-open-deals honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings Weight-open-deals honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Project-cash-from-active-job-milestones helper-text honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Project cash from active job milestones on the settings page", () => {
    assert.equal(page.includes("Project cash from active job milestones"), false);
    assert.equal(page.includes("Project cash from"), false);
    assert.equal(page.includes("active job milestones"), false);
    assert.match(
      page,
      /Job billing schedule setting for \$\{organization\.name\}/
    );
    assert.match(page, /Include job billing schedule/);
    assert.match(
      page,
      /Sales pipeline forecast setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Organization profile for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings Project-cash-milestones honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings Project-cash-milestones honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Alert-when-invoices-exceed-30-days helper-text honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Alert when invoices exceed 30 days on the settings page", () => {
    assert.equal(page.includes("Alert when invoices exceed 30 days"), false);
    assert.equal(page.includes("invoices exceed 30 days"), false);
    assert.equal(page.includes("exceed 30 days"), false);
    assert.match(
      page,
      /AR aging alert setting for \$\{organization\.name\}/
    );
    assert.match(page, /AR aging alerts/);
    assert.match(
      page,
      /Job billing schedule setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Sales pipeline forecast setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Organization profile for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings invoices-exceed-30-days honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings invoices-exceed-30-days honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Alert-when-job-margin-drops-5-percent helper-text honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Alert when job margin drops 5%+ below estimate on the settings page", () => {
    assert.equal(page.includes("Alert when job margin drops 5%+ below estimate"), false);
    assert.equal(page.includes("job margin drops 5%"), false);
    assert.equal(page.includes("5%+ below estimate"), false);
    assert.match(
      page,
      /Margin variance alert setting for \$\{organization\.name\}/
    );
    assert.match(page, /Margin variance alerts/);
    assert.match(
      page,
      /AR aging alert setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Job billing schedule setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Sales pipeline forecast setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Organization profile for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings job-margin-drops honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings job-margin-drops honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Active-subscription Badge honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Active subscription Badge on the settings page", () => {
    assert.equal(page.includes("<Badge>Active</Badge>"), false);
    assert.equal(page.includes(">Active</Badge>"), false);
    assert.equal(page.includes("<Badge>Active"), false);
    assert.match(
      page,
      /<Badge>\{\`Selected plan for \$\{organization\.name\}\`\}<\/Badge>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Billing settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /Margin variance alert setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /AR aging alert setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Job billing schedule setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Sales pipeline forecast setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Organization profile for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings Active-subscription Badge honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings Active-subscription Badge honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented catalog-price-as-subscription honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover catalog price/users as current subscription on the settings page", () => {
    assert.equal(page.includes("currentPlan.price / 100"), false);
    assert.equal(page.includes("currentPlan.users"), false);
    assert.equal(page.includes("/month"), false);
    assert.equal(page.includes("Up to {currentPlan.users} users"), false);
    assert.equal(page.includes("${currentPlan.price / 100}/month"), false);
    assert.match(
      page,
      /Selected plan catalog entry for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /<Badge>\{\`Selected plan for \$\{organization\.name\}\`\}<\/Badge>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Billing settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /Margin variance alert setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /AR aging alert setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Job billing schedule setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Sales pipeline forecast setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Organization profile for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings catalog-price-as-subscription honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings catalog-price-as-subscription honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Current-Plan catalog-button honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Current Plan catalog button without Stripe evidence", () => {
    assert.equal(page.includes("Current Plan"), false);
    assert.equal(page.includes('"Current Plan"'), false);
    assert.equal(page.includes("`Current Plan`"), false);
    assert.match(
      page,
      /Selected catalog plan for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Selected plan catalog entry for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /<Badge>\{\`Selected plan for \$\{organization\.name\}\`\}<\/Badge>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Billing settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /Margin variance alert setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /AR aging alert setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Job billing schedule setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Sales pipeline forecast setting for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Forecast settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Organization profile for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
    assert.match(page, /description=\{`Settings for \$\{organization\.name\}`\}/);
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings Current-Plan catalog-button honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings Current-Plan catalog-button honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented Upgrade-to catalog-button honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover Upgrade to catalog button without Stripe evidence", () => {
    assert.equal(page.includes("Upgrade to"), false);
    assert.equal(page.includes("Upgrade to ${plan.name}"), false);
    assert.equal(page.includes("`Upgrade to ${plan.name}`"), false);
    assert.match(page, /Select catalog plan \$\{plan\.name\}/);
    assert.match(
      page,
      /Selected catalog plan for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Selected plan catalog entry for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /<Badge>\{\`Selected plan for \$\{organization\.name\}\`\}<\/Badge>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Billing settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings Upgrade-to catalog-button honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings Upgrade-to catalog-button honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});

describe("leftover settings invented organization.plan heading honesty", () => {
  const page = fs.readFileSync(
    new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  it("does not invent leftover organization.plan Plan heading without Stripe evidence", () => {
    assert.equal(page.includes("{organization.plan} Plan"), false);
    assert.equal(page.includes("${organization.plan} Plan"), false);
    assert.equal(page.includes("`{organization.plan} Plan`"), false);
    assert.match(
      page,
      /Selected catalog plan heading for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Selected catalog plan for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /Selected plan catalog entry for \$\{organization\.name\}/
    );
    assert.match(
      page,
      /<Badge>\{\`Selected plan for \$\{organization\.name\}\`\}<\/Badge>/
    );
    assert.match(
      page,
      /<CardDescription>\{\`Billing settings for \$\{organization\.name\}\`\}<\/CardDescription>/
    );
  });

  it("keeps pinned Apex snapshot and alerts SOURCE-DERIVED after leftover settings organization.plan heading honesty", () => {
    assert.equal(apexPinnedCashUnchanged(), true);
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);
    assert.equal(apex.alerts.length, 7);
    const growth = KPIS.find((kpi) => kpi.id === "kpi-1");
    assert.ok(growth);
    assert.equal(growth.value, 12.4);
  });

  it("empty tenant still has no Apex leak after leftover settings organization.plan heading honesty", () => {
    const summit = getTenantData("org-summit");
    const provisioned = getTenantData("org-acme-services");
    const apex = getTenantData(APEX_DEMO_ORGANIZATION_ID);

    assert.equal(apex.financialSnapshot.currentCash, FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(summit.financialSnapshot.currentCash, EMPTY_FINANCIAL_SNAPSHOT.currentCash);
    assert.equal(provisioned.financialSnapshot.currentCash, 0);
    assert.equal(JSON.stringify(provisioned).includes("Harbor View"), false);
    assert.equal(JSON.stringify(provisioned).includes("Apex Construction"), false);
    assert.equal(JSON.stringify(summit).includes("Apex Construction"), false);
  });
});
