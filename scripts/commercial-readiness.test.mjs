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
