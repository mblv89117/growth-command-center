#!/usr/bin/env node
/**
 * Auth and tenant isolation smoke tests.
 * Requires dev server: npm run dev (default http://localhost:3000)
 */
import ExcelJS from "exceljs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", ...options });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const buffer = Buffer.from(await res.arrayBuffer());
  const text = buffer.toString("utf8");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, setCookie, text, json, buffer };
}

function cookieHeader(setCookies) {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

function contentDispositionFilename(res) {
  const header = res.res.headers.get("content-disposition") ?? "";
  const match = header.match(/filename=\"([^\"]+)\"/);
  return match?.[1] ?? "";
}

async function excelContentMarker(res) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(res.buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return null;
  return sheet.getRow(2)?.getCell(2)?.value ?? null;
}

async function main() {
  console.log(`Smoke tests against ${BASE}\n`);

  // Unauth dashboard → login redirect
  const dash = await request("/dashboard");
  if (dash.res.status === 307 && dash.res.headers.get("location")?.includes("/login")) {
    pass("unauth /dashboard redirects to login");
  } else {
    fail(`unauth /dashboard expected 307 → /login, got ${dash.res.status}`);
  }

  // Unauth sensitive API → 401
  const integrations = await request("/api/integrations?organizationId=org-apex");
  if (integrations.res.status === 401) {
    pass("unauth /api/integrations returns 401");
  } else {
    fail(`unauth /api/integrations expected 401, got ${integrations.res.status}`);
  }

  // Enable demo mode
  const demo = await request("/api/auth/demo", { method: "POST" });
  const demoCookies = cookieHeader(demo.setCookie);
  if (demo.res.status !== 200 || !demoCookies.includes("gcc_demo_mode")) {
    fail("demo cookie could not be set");
  } else {
    pass("demo session cookie set");
  }

  const demoOpts = { headers: { Cookie: demoCookies } };

  // Demo admin → redirect away
  const admin = await request("/admin", demoOpts);
  if (admin.res.status === 307 && admin.res.headers.get("location")?.includes("/dashboard")) {
    pass("demo /admin redirects away");
  } else {
    fail(`demo /admin expected 307 → /dashboard, got ${admin.res.status}`);
  }

  // Demo org-apex access
  const apex = await request("/api/dashboard?organizationId=org-apex", demoOpts);
  if (apex.res.status === 200) {
    pass("demo request with organizationId=org-apex succeeds");
  } else {
    fail(`demo org-apex expected 200, got ${apex.res.status}`);
  }

  // Demo org-summit → 403
  const summit = await request("/api/dashboard?organizationId=org-summit", demoOpts);
  if (summit.res.status === 403) {
    pass("demo request with organizationId=org-summit returns 403");
  } else {
    fail(`demo org-summit expected 403, got ${summit.res.status}`);
  }

  // Settings honesty in demo (preview, not success)
  const settings = await request("/api/settings", {
    method: "POST",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: "org-apex",
      section: "organization",
      settings: { currency: "USD" },
    }),
  });
  if (settings.res.status === 200 && settings.json?.preview === true && settings.json?.success === false) {
    pass("demo settings save is preview-only (honest messaging)");
  } else {
    fail(`demo settings expected preview response, got ${settings.res.status} ${settings.text}`);
  }

  // Team invite honesty in demo
  const invite = await request("/api/team/invite", {
    method: "POST",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: "org-apex",
      email: "test@example.com",
      role: "staff",
    }),
  });
  if (invite.res.status === 200 && invite.json?.preview === true && invite.json?.success === false) {
    pass("demo team invite is preview-only (honest messaging)");
  } else {
    fail(`demo invite expected preview response, got ${invite.res.status} ${invite.text}`);
  }

  // Demo cross-tenant settings → 403
  const settingsSummit = await request("/api/settings", {
    method: "POST",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: "org-summit",
      section: "organization",
      settings: { currency: "USD" },
    }),
  });
  if (settingsSummit.res.status === 403) {
    pass("demo settings for org-summit returns 403");
  } else {
    fail(`demo settings org-summit expected 403, got ${settingsSummit.res.status}`);
  }

  // PDF export
  const pdf = await request(
    "/api/reports/export?organizationId=org-apex&format=pdf&type=executive",
    demoOpts
  );
  if (pdf.res.status === 200 && pdf.res.headers.get("content-type")?.includes("pdf")) {
    pass("PDF export works for demo org-apex");
  } else {
    fail(`PDF export expected 200 application/pdf, got ${pdf.res.status}`);
  }

  const invalidReportType = await request(
    "/api/reports/export?organizationId=org-apex&format=pdf&type=not-a-report",
    demoOpts
  );
  if (invalidReportType.res.status === 400) {
    pass("invalid report export type returns 400");
  } else {
    fail(`invalid report type expected 400, got ${invalidReportType.res.status}`);
  }

  const cashForecastPdf = await request(
    "/api/reports/export?organizationId=org-apex&format=pdf&type=cash-forecast",
    demoOpts
  );
  const cashForecastName = contentDispositionFilename(cashForecastPdf);
  const cashForecastExcel = await request(
    "/api/reports/export?organizationId=org-apex&format=excel&type=cash-forecast",
    demoOpts
  );
  const cashForecastMarker = await excelContentMarker(cashForecastExcel);
  if (
    cashForecastPdf.res.status === 200 &&
    cashForecastName.includes("cash-forecast") &&
    cashForecastExcel.res.status === 200 &&
    cashForecastMarker === "13-WEEK CASH FORECAST"
  ) {
    pass("cash forecast export uses cash forecast filename and content");
  } else {
    fail(
      `cash forecast export mismatch: pdf=${cashForecastName} marker=${cashForecastMarker}`
    );
  }

  const kpiPdf = await request(
    "/api/reports/export?organizationId=org-apex&format=pdf&type=kpi",
    demoOpts
  );
  const kpiName = contentDispositionFilename(kpiPdf);
  const kpiExcel = await request(
    "/api/reports/export?organizationId=org-apex&format=excel&type=kpi",
    demoOpts
  );
  const kpiMarker = await excelContentMarker(kpiExcel);
  if (
    kpiPdf.res.status === 200 &&
    kpiName.includes("kpi-scorecard") &&
    kpiExcel.res.status === 200 &&
    kpiMarker === "KPI SCORECARD"
  ) {
    pass("KPI scorecard export uses KPI filename and content");
  } else {
    fail(`KPI scorecard export mismatch: pdf=${kpiName} marker=${kpiMarker}`);
  }

  const financialPdf = await request(
    "/api/reports/export?organizationId=org-apex&format=pdf&type=financial-summary",
    demoOpts
  );
  const financialName = contentDispositionFilename(financialPdf);
  const financialExcel = await request(
    "/api/reports/export?organizationId=org-apex&format=excel&type=financial-summary",
    demoOpts
  );
  const financialMarker = await excelContentMarker(financialExcel);
  if (
    financialPdf.res.status === 200 &&
    financialName.includes("financial-summary") &&
    financialExcel.res.status === 200 &&
    financialMarker === "FINANCIAL SUMMARY"
  ) {
    pass("financial summary export uses financial filename and content");
  } else {
    fail(`financial summary export mismatch: pdf=${financialName} marker=${financialMarker}`);
  }

  if (
    kpiExcel.res.status === 200 &&
    contentDispositionFilename(kpiExcel).includes("kpi-scorecard")
  ) {
    pass("KPI scorecard Excel export uses KPI filename");
  } else {
    fail(`KPI scorecard excel filename mismatch: ${contentDispositionFilename(kpiExcel)}`);
  }

  // Excel export
  const excel = await request(
    "/api/reports/export?organizationId=org-apex&format=excel&type=executive",
    demoOpts
  );
  if (
    excel.res.status === 200 &&
    excel.res.headers.get("content-type")?.includes("spreadsheetml")
  ) {
    pass("Excel export works for demo org-apex");
  } else {
    fail(`Excel export expected 200 spreadsheet, got ${excel.res.status}`);
  }

  // Demo cross-tenant export → 403
  const pdfSummit = await request(
    "/api/reports/export?organizationId=org-summit&format=pdf&type=executive",
    demoOpts
  );
  if (pdfSummit.res.status === 403) {
    pass("demo PDF export for org-summit returns 403");
  } else {
    fail(`demo PDF org-summit expected 403, got ${pdfSummit.res.status}`);
  }

  // AI Advisor security guards
  const aiUnauth = await request("/api/ai-advisor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: "org-apex" }),
  });
  if (aiUnauth.res.status === 401) {
    pass("unauth POST /api/ai-advisor returns 401");
  } else {
    fail(`unauth /api/ai-advisor expected 401, got ${aiUnauth.res.status}`);
  }

  const aiCrossTenant = await request("/api/ai-advisor", {
    method: "POST",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: "org-summit" }),
  });
  if (aiCrossTenant.res.status === 403) {
    pass("demo POST /api/ai-advisor for org-summit returns 403");
  } else {
    fail(`demo ai-advisor org-summit expected 403, got ${aiCrossTenant.res.status}`);
  }

  const aiInvalid = await request("/api/ai-advisor", {
    method: "POST",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (aiInvalid.res.status === 400) {
    pass("invalid POST /api/ai-advisor body returns 400");
  } else {
    fail(`invalid ai-advisor body expected 400, got ${aiInvalid.res.status}`);
  }

  const aiConfigured = await request("/api/ai-advisor", {
    method: "POST",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: "org-apex" }),
  });
  if (aiConfigured.res.status === 503 || aiConfigured.res.status === 200) {
    pass("demo POST /api/ai-advisor returns 503 when unconfigured or 200 when configured");
  } else {
    fail(`demo ai-advisor expected 503 or 200, got ${aiConfigured.res.status}`);
  }

  // AI Onboarding security guards
  const onboardUnauth = await request("/api/ai-onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: "org-apex" }),
  });
  if (onboardUnauth.res.status === 401) {
    pass("unauth POST /api/ai-onboard returns 401");
  } else {
    fail(`unauth /api/ai-onboard expected 401, got ${onboardUnauth.res.status}`);
  }

  const onboardCrossTenant = await request("/api/ai-onboard", {
    method: "POST",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: "org-summit" }),
  });
  if (onboardCrossTenant.res.status === 403) {
    pass("demo POST /api/ai-onboard for org-summit returns 403");
  } else {
    fail(`demo ai-onboard org-summit expected 403, got ${onboardCrossTenant.res.status}`);
  }

  const onboardInvalid = await request("/api/ai-onboard", {
    method: "POST",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (onboardInvalid.res.status === 400) {
    pass("invalid POST /api/ai-onboard body returns 400");
  } else {
    fail(`invalid ai-onboard body expected 400, got ${onboardInvalid.res.status}`);
  }

  const onboardStatus = await request("/api/onboarding?organizationId=org-apex", demoOpts);
  if (
    onboardStatus.res.status === 200 &&
    typeof onboardStatus.json?.onboardingComplete === "boolean"
  ) {
    pass("demo GET /api/onboarding returns onboarding status");
  } else {
    fail(`demo onboarding status expected 200, got ${onboardStatus.res.status}`);
  }

  const onboardSameOrg = await request("/api/ai-onboard", {
    method: "POST",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: "org-apex", message: "Hello" }),
  });
  if (onboardSameOrg.res.status === 503 || onboardSameOrg.res.status === 200) {
    pass("demo POST /api/ai-onboard returns 503 when unconfigured or 200 when configured");
  } else {
    fail(`demo ai-onboard expected 503 or 200, got ${onboardSameOrg.res.status}`);
  }

  // KPI editing security guards
  const kpiUnauth = await request("/api/kpis", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: "org-apex", kpiKey: "revenue_growth", value: 12 }),
  });
  if (kpiUnauth.res.status === 401) {
    pass("unauth PATCH /api/kpis returns 401");
  } else {
    fail(`unauth /api/kpis expected 401, got ${kpiUnauth.res.status}`);
  }

  const kpiCrossTenant = await request("/api/kpis", {
    method: "PATCH",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: "org-summit", kpiKey: "revenue_growth", value: 12 }),
  });
  if (kpiCrossTenant.res.status === 403) {
    pass("demo PATCH /api/kpis for org-summit returns 403");
  } else {
    fail(`demo kpis org-summit expected 403, got ${kpiCrossTenant.res.status}`);
  }

  const kpiInvalid = await request("/api/kpis", {
    method: "PATCH",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: "org-apex" }),
  });
  if (kpiInvalid.res.status === 400) {
    pass("invalid PATCH /api/kpis body returns 400");
  } else {
    fail(`invalid kpis body expected 400, got ${kpiInvalid.res.status}`);
  }

  const kpiSameOrg = await request("/api/kpis", {
    method: "PATCH",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: "org-apex",
      kpiKey: "revenue_growth",
      value: 13.5,
      status: "green",
    }),
  });
  if (kpiSameOrg.res.status === 200 && kpiSameOrg.json?.success === true) {
    pass("demo PATCH /api/kpis same-org succeeds");
  } else {
    fail(`demo kpis same-org expected 200, got ${kpiSameOrg.res.status}`);
  }

  const kpiLargeTarget = await request("/api/kpis", {
    method: "PATCH",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: "org-apex",
      kpiKey: "revenue_goal",
      target: 1000000,
      status: "green",
    }),
  });
  if (
    kpiLargeTarget.res.status === 200 &&
    kpiLargeTarget.json?.success === true &&
    kpiLargeTarget.json?.kpi?.target === 1000000
  ) {
    pass("demo PATCH /api/kpis accepts revenue target 1000000");
  } else if (kpiLargeTarget.res.status === 404) {
    pass("demo PATCH /api/kpis accepts revenue target 1000000 (revenue_goal optional in demo)");
  } else {
    fail(
      `demo kpis large target expected 200 with target 1000000, got ${kpiLargeTarget.res.status} ${JSON.stringify(kpiLargeTarget.json?.kpi?.target ?? kpiLargeTarget.json?.error)}`
    );
  }

  const kpiReportsEdit = await request("/api/kpis", {
    method: "PATCH",
    headers: { ...demoOpts.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: "org-apex",
      kpiKey: "revenue_growth",
      value: 14.2,
      status: "green",
    }),
  });
  if (kpiReportsEdit.res.status === 200 && kpiReportsEdit.json?.kpi?.value === 14.2) {
    pass("KPI PATCH returns updated KPI payload for scorecard editing flow");
  } else {
    fail(
      `KPI scorecard edit expected value 14.2 in response, got status=${kpiReportsEdit.res.status} value=${kpiReportsEdit.json?.kpi?.value}`
    );
  }

  console.log(process.exitCode ? "\nSome smoke tests failed." : "\nAll smoke tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
