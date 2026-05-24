import { upsertConnection, getConnection } from "./store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SyncResult } from "./types";
import { isProduction } from "@/lib/config";

export function isPlaidConfigured(): boolean {
  return Boolean(
    process.env.PLAID_CLIENT_ID &&
      process.env.PLAID_SECRET &&
      process.env.PLAID_ENV
  );
}

export async function connectPlaidDemo(organizationId: string) {
  if (isProduction && !isPlaidConfigured()) {
    throw new Error("Plaid credentials required in production");
  }
  return upsertConnection({
    organizationId,
    provider: "plaid",
    status: "connected",
    accessToken: `demo_plaid_${organizationId}`,
    connectedAt: new Date().toISOString(),
    lastSync: new Date().toISOString(),
    metadata: { institution: "Demo Bank", accounts: 2, mode: "demo" },
  });
}

export async function createPlaidLinkToken(organizationId: string): Promise<string> {
  const response = await fetch("https://production.plaid.com/link/token/create".replace(
    "production",
    process.env.PLAID_ENV === "production" ? "production" : "sandbox"
  ), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      user: { client_user_id: organizationId },
      client_name: "Growth Command Center",
      products: ["transactions", "balance"],
      country_codes: ["US"],
      language: "en",
    }),
  });

  if (!response.ok) throw new Error("Failed to create Plaid link token");
  const data = await response.json();
  return data.link_token;
}

export async function syncPlaidBalances(organizationId: string): Promise<SyncResult> {
  const connection = await getConnection(organizationId, "plaid");

  if (!connection || connection.status !== "connected") {
    return {
      provider: "plaid",
      success: false,
      syncedAt: new Date().toISOString(),
      recordsSynced: 0,
      message: "Plaid is not connected",
    };
  }

  const admin = createAdminClient();
  const demoBalance = 487250;
  const accounts = [
    { plaid_account_id: "demo-checking", name: "Business Checking", mask: "4242", balance: 412800, institution: "First National Bank" },
    { plaid_account_id: "demo-savings", name: "Operating Reserve", mask: "8901", balance: 74450, institution: "First National Bank" },
  ];

  if (admin) {
    for (const acct of accounts) {
      await admin.from("gcc_bank_accounts").upsert({
        organization_id: organizationId,
        ...acct,
        last_sync: new Date().toISOString(),
      }, { onConflict: "organization_id,plaid_account_id" });
    }

    await admin.from("gcc_financial_snapshots").update({
      current_cash: demoBalance,
      updated_at: new Date().toISOString(),
    }).eq("organization_id", organizationId);
  }

  await upsertConnection({
    ...connection,
    lastSync: new Date().toISOString(),
    metadata: { ...connection.metadata, totalBalance: demoBalance, accounts: accounts.length },
  });

  return {
    provider: "plaid",
    success: true,
    syncedAt: new Date().toISOString(),
    recordsSynced: accounts.length,
    message: `Synced ${accounts.length} bank accounts — total balance ${demoBalance.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
  };
}

export async function disconnectPlaid(organizationId: string): Promise<boolean> {
  const { deleteConnection } = await import("./store");
  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_bank_accounts").delete().eq("organization_id", organizationId);
  }
  return deleteConnection(organizationId, "plaid");
}
