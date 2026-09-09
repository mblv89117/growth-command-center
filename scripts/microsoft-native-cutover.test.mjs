#!/usr/bin/env node
/**
 * Microsoft-native cutover helpers + Atlas tenant isolation + Hub ingest security.
 * Uses node:test (no vitest) so Azure Docker / Next typecheck stay clean.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import {
  clientCodeForOrganizationId,
  dualResolveGccIdentity,
  organizationIdForClientCode,
} from "../src/lib/atlas/clientCodeMap.ts";
import {
  buildGccValueSignalEnvelope,
  postGccEnvelopeToHub,
} from "../src/lib/atlas/hubIngest.ts";
import { getAuthProvider } from "../src/lib/auth/entra/config.ts";
import {
  isEntraSessionGateSatisfied,
  shouldUseSupabaseSessionGate,
} from "../src/lib/auth/session-gate.ts";
import {
  assertOrganizationIdMatch,
  DASHBOARD_AGGREGATE_TABLES,
  fetchDashboardAggregatesByOrganizationId,
  fetchTenantAggregatesByOrganizationId,
  filterRowsByOrganizationId,
  isAzureDataPlaneActive,
  isPersistentDataBackendAvailable,
  resolveDataBackend,
  TENANT_EXTENDED_AGGREGATE_TABLES,
} from "../src/lib/data/data-plane.ts";
import { azurePgRateLimitStore } from "../src/lib/rate-limit/azure-pg-store.ts";
import { memoryRateLimitStore } from "../src/lib/rate-limit/memory-store.ts";
import { supabaseRateLimitStore } from "../src/lib/rate-limit/supabase-store.ts";
import { __resetPgPoolForTests, getDatabaseUrl } from "../src/lib/db/pool.ts";
import {
  selectProductionAuthAndDb,
  snapshotMicrosoftNativeRuntime,
} from "../src/lib/runtime/microsoft-native.ts";
import { validateProductionEnv } from "../src/lib/config.ts";

function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const previous = {};
  for (const key of keys) {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined || value === null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("tenant isolation: fail-closes unknown ClientCode", () => {
  assert.equal(organizationIdForClientCode("ZZZZ99"), null);
  assert.equal(organizationIdForClientCode("bad"), null);
});

test("tenant isolation: dual-resolves SYN01 fixture", () => {
  const r = dualResolveGccIdentity({ clientCode: "SYN01" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.organizationId, "org-syn01");
});

test("tenant isolation: rejects cross-tenant injection", () => {
  const r = dualResolveGccIdentity({
    clientCode: "SYN01",
    organizationId: "org-other",
  });
  assert.equal(r.ok, false);
});

test("tenant isolation: org → ClientCode fixture", () => {
  assert.equal(clientCodeForOrganizationId("org-syn01"), "SYN01");
  assert.equal(clientCodeForOrganizationId("missing"), null);
});

test("AUTH_PROVIDER defaults to supabase", () => {
  withEnv({ AUTH_PROVIDER: undefined }, () => {
    assert.equal(getAuthProvider(), "supabase");
  });
  withEnv({ AUTH_PROVIDER: "SUPABASE" }, () => {
    assert.equal(getAuthProvider(), "supabase");
  });
});

test("AUTH_PROVIDER dual-mode selects entra without crash", () => {
  withEnv(
    {
      AUTH_PROVIDER: "entra",
      ENTRA_EXTERNAL_TENANT_ID: undefined,
      ENTRA_EXTERNAL_CLIENT_ID: undefined,
      ENTRA_EXTERNAL_CLIENT_SECRET: undefined,
      SESSION_SECRET: undefined,
    },
    () => {
      const snap = selectProductionAuthAndDb({ authProvider: "entra" });
      assert.equal(snap.authProvider, "entra");
      assert.ok(Array.isArray(snap.cutoverBlockers));
      assert.ok(snap.cutoverBlockers.length >= 1);
    }
  );
});

test("pool prefers AZURE_DATABASE_URL over DATABASE_URL", () => {
  withEnv(
    {
      AZURE_DATABASE_URL: "postgresql://azure.example/gcc?sslmode=require",
      DATABASE_URL: "postgresql://legacy.example/gcc?sslmode=require",
    },
    () => {
      __resetPgPoolForTests();
      assert.equal(
        getDatabaseUrl(),
        "postgresql://azure.example/gcc?sslmode=require"
      );
      const snap = snapshotMicrosoftNativeRuntime();
      assert.equal(snap.databaseUrlSource, "AZURE_DATABASE_URL");
      assert.equal(snap.dataPlane, "azure-postgres");
      assert.equal(resolveDataBackend(), "azure-postgres");
      assert.equal(isAzureDataPlaneActive(), true);
    }
  );
});

test("data-plane defaults to supabase when Azure URL unset", () => {
  withEnv(
    {
      AZURE_DATABASE_URL: undefined,
      DATABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    },
    () => {
      __resetPgPoolForTests();
      assert.equal(isAzureDataPlaneActive(), false);
      assert.equal(resolveDataBackend(), "supabase");
    }
  );
});

test("data-plane fail-closes on organization id mismatch", () => {
  assert.equal(assertOrganizationIdMatch("org-a", "org-a"), true);
  assert.equal(assertOrganizationIdMatch("org-a", "org-b"), false);
  assert.equal(assertOrganizationIdMatch("org-a", null), false);
  assert.equal(assertOrganizationIdMatch("", "org-a"), false);
});

test("data-plane filterRowsByOrganizationId drops cross-tenant rows", () => {
  const rows = [
    { organization_id: "org-a", value: 1 },
    { organization_id: "org-b", value: 2 },
    { organization_id: "org-a", value: 3 },
  ];
  const scoped = filterRowsByOrganizationId("org-a", rows);
  assert.equal(scoped.length, 2);
  assert.deepEqual(
    scoped.map((r) => r.value),
    [1, 3]
  );
  assert.deepEqual(filterRowsByOrganizationId("", rows), []);
  assert.deepEqual(filterRowsByOrganizationId("org-a", []), []);
});

test("dashboard/tenant aggregate fetchers stay inactive without Azure URL", async () => {
  await withEnv(
    {
      AZURE_DATABASE_URL: undefined,
      DATABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    },
    async () => {
      __resetPgPoolForTests();
      assert.equal(isAzureDataPlaneActive(), false);
      assert.equal(await fetchDashboardAggregatesByOrganizationId("org-a"), null);
      assert.equal(await fetchTenantAggregatesByOrganizationId("org-a"), null);
    }
  );
});

test("isPersistentDataBackendAvailable prefers Azure PG without Supabase keys", () => {
  withEnv(
    {
      AZURE_DATABASE_URL: "postgresql://azure.example/gcc?sslmode=require",
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    () => {
      __resetPgPoolForTests();
      assert.equal(isAzureDataPlaneActive(), true);
      assert.equal(isPersistentDataBackendAvailable(), true);
    }
  );
});

test("isPersistentDataBackendAvailable falls back to Supabase admin when Azure unset", () => {
  withEnv(
    {
      AZURE_DATABASE_URL: undefined,
      DATABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    },
    () => {
      __resetPgPoolForTests();
      assert.equal(isAzureDataPlaneActive(), false);
      assert.equal(isPersistentDataBackendAvailable(), true);
    }
  );
});

test("rate-limit azure store fails closed without live DB; checkRateLimit falls back to memory", async () => {
  const { checkRateLimit } = await import("../src/lib/rate-limit/index.ts");

  await withEnv(
    {
      AZURE_DATABASE_URL: "postgresql://azure.example/gcc?sslmode=require",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    },
    async () => {
      __resetPgPoolForTests();
      await assert.rejects(
        () =>
          azurePgRateLimitStore.consume("test:bucket", 5, 60_000),
        /connect|ECONNREFUSED|getaddrinfo|timeout/i
      );

      const result = await checkRateLimit({
        route: "test-route",
        userId: "user-1",
        limit: 5,
        windowMs: 60_000,
      });
      assert.equal(result.allowed, true);
    }
  );
});

test("rate-limit store selection: azure before supabase before memory", () => {
  withEnv(
    {
      AZURE_DATABASE_URL: "postgresql://azure.example/gcc?sslmode=require",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    },
    () => {
      __resetPgPoolForTests();
      assert.equal(isAzureDataPlaneActive(), true);
      assert.ok(azurePgRateLimitStore);
      assert.notEqual(azurePgRateLimitStore, supabaseRateLimitStore);
      assert.notEqual(azurePgRateLimitStore, memoryRateLimitStore);
    }
  );

  withEnv(
    {
      AZURE_DATABASE_URL: undefined,
      DATABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    },
    () => {
      __resetPgPoolForTests();
      assert.equal(isAzureDataPlaneActive(), false);
      assert.ok(supabaseRateLimitStore);
    }
  );
});

test("expanded data-plane modules export KPI and integration helpers", async () => {
  const dataPlane = await import("../src/lib/data/data-plane.ts");
  for (const fn of [
    "fetchKpiRowByKey",
    "updateKpiRowByKey",
    "upsertKpiRow",
    "fetchKpiKeysWithTargets",
    "fetchOnboardingMessagesByOrganizationId",
    "insertOnboardingMessage",
    "fetchIntegrationConnection",
    "fetchIntegrationConnectionsByOrganizationId",
    "upsertIntegrationConnectionRow",
    "deleteIntegrationConnection",
  ]) {
    assert.equal(typeof dataPlane[fn], "function", `${fn} should be exported`);
  }
});

test("dashboard/tenant aggregate table coverage lists primary modules", () => {
  assert.deepEqual(DASHBOARD_AGGREGATE_TABLES, [
    "gcc_financial_snapshots",
    "gcc_monthly_trends",
    "gcc_budget_vs_actual",
    "gcc_kpis",
    "gcc_alerts",
  ]);
  assert.ok(TENANT_EXTENDED_AGGREGATE_TABLES.includes("gcc_cash_forecast_weeks"));
  assert.ok(TENANT_EXTENDED_AGGREGATE_TABLES.includes("gcc_transactions"));
  assert.equal(TENANT_EXTENDED_AGGREGATE_TABLES.length, 12);
});

test("entra session gate does not require Supabase URL", () => {
  assert.equal(shouldUseSupabaseSessionGate("entra"), false);
  assert.equal(shouldUseSupabaseSessionGate("supabase"), true);

  withEnv(
    {
      AUTH_PROVIDER: "entra",
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    },
    () => {
      assert.equal(getAuthProvider(), "entra");
      assert.equal(
        isEntraSessionGateSatisfied(
          [{ name: "gcc_entra_session", value: "sealed-token" }],
          {
            entraSessionCookieName: "gcc_entra_session",
            demoModeAllowed: false,
            demoModeCookieName: "gcc_demo_mode",
          }
        ),
        true
      );
      assert.equal(
        isEntraSessionGateSatisfied([], {
          entraSessionCookieName: "gcc_entra_session",
          demoModeAllowed: false,
          demoModeCookieName: "gcc_demo_mode",
        }),
        false
      );
    }
  );
});

test("production validateProductionEnv allows azure/entra selection without throw", () => {
  withEnv(
    {
      NODE_ENV: "production",
      AUTH_PROVIDER: "entra",
      ENTRA_EXTERNAL_TENANT_ID: "tid",
      ENTRA_EXTERNAL_CLIENT_ID: "cid",
      ENTRA_EXTERNAL_CLIENT_SECRET: "csecret",
      SESSION_SECRET: "x".repeat(32),
      AZURE_DATABASE_URL: "postgresql://azure.example/gcc?sslmode=require",
      NEXT_PUBLIC_APP_URL: "https://app.growthcommandcenter.com",
      NEXT_PUBLIC_MARKETING_URL: "https://growthcommandcenter.com",
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    () => {
      const missing = validateProductionEnv();
      assert.deepEqual(missing, []);
    }
  );
});

test("hub ingest does not send module key secret as a header", async () => {
  const secret = "test-module-ingest-secret";
  /** @type {import('node:http').IncomingMessage['headers'] | null} */
  let seenHeaders = null;

  const server = createServer((req, res) => {
    seenHeaders = req.headers;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const base = `http://127.0.0.1:${addr.port}`;

  try {
    const envelope = buildGccValueSignalEnvelope({
      clientCode: "SYN01",
      signalType: "cash_runway",
      confidence: "ESTIMATED",
      finding: "fixture",
      evidence: "unit-test",
      correlationId: "corr-1",
      actor: "test",
    });
    const result = await postGccEnvelopeToHub(
      {
        hubBaseUrl: base,
        moduleIngestKey: secret,
        moduleIngestKeyId: "gcc",
      },
      envelope
    );
    assert.equal(result.ok, true);
    assert.ok(seenHeaders);
    assert.equal(seenHeaders["x-atlas-module-key"], undefined);
    assert.equal(seenHeaders["x-atlas-module-key-id"], "gcc");
    assert.ok(seenHeaders["x-atlas-module-signature"]);
    assert.ok(seenHeaders["x-atlas-module-timestamp"]);
    const headerBlob = JSON.stringify(seenHeaders);
    assert.equal(headerBlob.includes(secret), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

console.log("microsoft-native-cutover tests: PASS");
