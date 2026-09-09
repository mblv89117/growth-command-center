import { upsertConnection, getConnection } from "./store";
import {
  deleteBankAccountsByOrganizationId,
  updateFinancialSnapshotCash,
  upsertBankAccounts,
} from "@/lib/data/active-runtime-plane";
import type { SyncResult } from "./types";
import { isProduction } from "@/lib/config";
import { isPersistentDataBackendAvailable } from "@/lib/data/data-plane";

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

  if (isProduction) {
    return {
      provider: "plaid",
      success: false,
      syncedAt: new Date().toISOString(),
      recordsSynced: 0,
      message: "Live Plaid balance sync is not enabled in this release",
    };
  }

  const demoBalance = 487250;
  const accounts = [
    { plaid_account_id: "demo-checking", name: "Business Checking", mask: "4242", balance: 412800, institution: "First National Bank" },
    { plaid_account_id: "demo-savings", name: "Operating Reserve", mask: "8901", balance: 74450, institution: "First National Bank" },
  ];

  if (isPersistentDataBackendAvailable()) {
    await upsertBankAccounts(organizationId, accounts);
    await updateFinancialSnapshotCash(organizationId, demoBalance);
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
  if (isPersistentDataBackendAvailable()) {
    await deleteBankAccountsByOrganizationId(organizationId);
  }
  return deleteConnection(organizationId, "plaid");
}
