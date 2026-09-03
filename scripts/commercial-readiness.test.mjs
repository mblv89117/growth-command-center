import { describe, it, before } from "node:test";
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

describe("connector registry", () => {
  it("has zero false-live connectors (live flag requires configured)", async () => {
    const { CONNECTOR_REGISTRY } = await import("../src/lib/connectors/registry.js");
    const falseLive = CONNECTOR_REGISTRY.filter((c) => c.isProductionLive && !c.isConfigured);
    assert.equal(falseLive.length, 0, `false-live: ${falseLive.map((c) => c.id).join(", ")}`);
  });

  it("marks upload connectors as production live", async () => {
    const { CONNECTOR_REGISTRY } = await import("../src/lib/connectors/registry.js");
    const csv = CONNECTOR_REGISTRY.find((c) => c.id === "csv");
    const pdf = CONNECTOR_REGISTRY.find((c) => c.id === "pdf");
    assert.ok(csv?.isProductionLive);
    assert.ok(pdf?.isProductionLive);
  });

  it("native connectors require provider approval", async () => {
    const { CONNECTOR_REGISTRY } = await import("../src/lib/connectors/registry.js");
    const qbo = CONNECTOR_REGISTRY.find((c) => c.id === "quickbooks");
    assert.ok(qbo);
    assert.equal(qbo.isProductionLive, false);
    assert.equal(qbo.requiresProviderApproval, true);
  });
});

describe("domain routing", () => {
  const marketingUrl = "https://growthcommandcenter.com";
  const appUrl = "https://app.growthcommandcenter.com";

  function mockRequest({ host, pathname, search = "" }) {
    return {
      headers: { get: (key) => (key === "host" ? host : null) },
      nextUrl: { pathname, search },
      cookies: { get: () => undefined },
    };
  }

  before(() => {
    process.env.NEXT_PUBLIC_MARKETING_URL = marketingUrl;
    process.env.NEXT_PUBLIC_APP_URL = appUrl;
  });

  it("redirects www to marketing apex", async () => {
    const { resolveWwwRedirectTarget } = await import("../src/lib/domains/routing.ts");
    const target = resolveWwwRedirectTarget(
      mockRequest({ host: "www.growthcommandcenter.com", pathname: "/pricing" })
    );
    assert.equal(target, `${marketingUrl}/pricing`);
  });

  it("keeps marketing homepage on apex", async () => {
    const { resolveMarketingToAppRedirectTarget } = await import("../src/lib/domains/routing.ts");
    const target = resolveMarketingToAppRedirectTarget(
      mockRequest({ host: "growthcommandcenter.com", pathname: "/" })
    );
    assert.equal(target, null);
  });

  it("redirects marketing auth routes to app subdomain", async () => {
    const { resolveMarketingToAppRedirectTarget } = await import("../src/lib/domains/routing.ts");
    const target = resolveMarketingToAppRedirectTarget(
      mockRequest({ host: "growthcommandcenter.com", pathname: "/signup", search: "?utm_source=360" })
    );
    assert.equal(target, `${appUrl}/signup?utm_source=360`);
  });

  it("redirects app root to login when logged out", async () => {
    const { resolveAppHostRedirectTarget } = await import("../src/lib/domains/routing.ts");
    const target = resolveAppHostRedirectTarget(
      mockRequest({ host: "app.growthcommandcenter.com", pathname: "/" }),
      false
    );
    assert.equal(target, "/login");
  });

  it("redirects app root to dashboard when logged in", async () => {
    const { resolveAppHostRedirectTarget } = await import("../src/lib/domains/routing.ts");
    const target = resolveAppHostRedirectTarget(
      mockRequest({ host: "app.growthcommandcenter.com", pathname: "/" }),
      true
    );
    assert.equal(target, "/dashboard");
  });

  it("redirects app pricing to marketing pricing", async () => {
    const { resolveAppHostRedirectTarget } = await import("../src/lib/domains/routing.ts");
    const target = resolveAppHostRedirectTarget(
      mockRequest({ host: "app.growthcommandcenter.com", pathname: "/pricing" }),
      false
    );
    assert.equal(target, `${marketingUrl}/pricing`);
  });

  it("keeps legal pages on marketing domain", async () => {
    const { MARKETING_ONLY_PATHS, resolveMarketingToAppRedirectTarget } = await import(
      "../src/lib/domains/routing.ts"
    );
    assert.ok(MARKETING_ONLY_PATHS.has("/privacy"));
    assert.ok(MARKETING_ONLY_PATHS.has("/terms"));

    const privacyRedirect = resolveMarketingToAppRedirectTarget(
      mockRequest({ host: "growthcommandcenter.com", pathname: "/privacy" })
    );
    assert.equal(privacyRedirect, null);
  });

  it("redirects app legal pages to marketing canonical URLs", async () => {
    const { resolveAppHostRedirectTarget } = await import("../src/lib/domains/routing.ts");
    const privacy = resolveAppHostRedirectTarget(
      mockRequest({ host: "app.growthcommandcenter.com", pathname: "/privacy" }),
      false
    );
    const terms = resolveAppHostRedirectTarget(
      mockRequest({ host: "app.growthcommandcenter.com", pathname: "/terms" }),
      false
    );
    assert.equal(privacy, `${marketingUrl}/privacy`);
    assert.equal(terms, `${marketingUrl}/terms`);
  });

  it("builds signup URLs on the app domain with UTM params", async () => {
    const { appSignupUrl } = await import("../src/lib/domains/links.ts");
    const url = appSignupUrl({ utm_source: "360", utm_campaign: "gcc-launch" });
    assert.equal(url, `${appUrl}/signup?utm_source=360&utm_campaign=gcc-launch`);
  });
});

describe("entitlements and billing", () => {
  it("grants HVCG included access without billing", async () => {
    const { resolveEntitlement } = await import("../src/lib/entitlements/index.ts");
    const result = resolveEntitlement({
      access_type: "hvcg_included",
      hvcg_engagement_active: true,
      subscription_status: "active",
    });
    assert.equal(result.hasAccess, true);
    assert.equal(result.showBilling, false);
    assert.equal(result.accessType, "hvcg_included");
  });

  it("allows standalone active and trialing subscriptions", async () => {
    const { resolveEntitlement } = await import("../src/lib/entitlements/index.ts");
    const active = resolveEntitlement({
      access_type: "standalone",
      subscription_status: "active",
    });
    const trialing = resolveEntitlement({
      access_type: "standalone",
      subscription_status: "trialing",
    });
    assert.equal(active.hasAccess, true);
    assert.equal(trialing.hasAccess, true);
    assert.equal(active.showBilling, true);
  });

  it("maps Stripe subscription states to GCC access types", async () => {
    const { mapStripeSubscriptionStatus } = await import("../src/lib/billing/stripe-sync.ts");
    assert.equal(mapStripeSubscriptionStatus("active").accessType, "standalone");
    assert.equal(mapStripeSubscriptionStatus("trialing").accessType, "standalone");
    assert.equal(mapStripeSubscriptionStatus("canceled").accessType, "inactive");
    assert.equal(mapStripeSubscriptionStatus("unpaid").hasPaidAccess, false);
  });

  it("uses standalone starter plan as default commercial price tier", async () => {
    const { STRIPE_PLANS, STANDALONE_PLAN_KEY } = await import("../src/lib/stripe/config.ts");
    assert.equal(STANDALONE_PLAN_KEY, "starter");
    assert.equal(STRIPE_PLANS.starter.price, 14900);
  });

  it("extracts subscription id from Stripe invoice parent details", async () => {
    const { getInvoiceSubscriptionId } = await import("../src/lib/billing/stripe-sync.ts");
    const invoice = {
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: "sub_123" },
      },
    };
    assert.equal(getInvoiceSubscriptionId(invoice), "sub_123");
  });
});
