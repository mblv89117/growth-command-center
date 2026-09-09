/**
 * Production-safe selectors for Microsoft-native DB/Auth dual-mode.
 * Default remains Supabase until AUTH_PROVIDER / cutover flags flip.
 * These helpers must not throw on missing optional Azure/Entra secrets.
 */
import {
  getAuthProvider,
  getEntraConfig,
  type AuthProvider,
} from "@/lib/auth/entra/config";
import { getDatabaseUrl, isAzurePostgresConfigured } from "@/lib/db/pool";
import { isSupabaseConfigured } from "@/lib/config";

export type DataPlane = "azure-postgres" | "supabase-postgres" | "unset";

export function resolveDataPlane(): DataPlane {
  if (process.env.AZURE_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim()) {
    return "azure-postgres";
  }
  if (isSupabaseConfigured()) return "supabase-postgres";
  return "unset";
}

export function databaseUrlSource(): "AZURE_DATABASE_URL" | "DATABASE_URL" | "none" {
  if (process.env.AZURE_DATABASE_URL?.trim()) return "AZURE_DATABASE_URL";
  if (process.env.DATABASE_URL?.trim()) return "DATABASE_URL";
  return "none";
}

export interface MicrosoftNativeRuntimeSnapshot {
  authProvider: AuthProvider;
  dataPlane: DataPlane;
  azurePostgresConfigured: boolean;
  entraConfigured: boolean;
  supabaseConfigured: boolean;
  databaseUrlSource: "AZURE_DATABASE_URL" | "DATABASE_URL" | "none";
  preferredDatabaseUrl: string | undefined;
  /** Soft blockers — never throws; safe to call in production boot. */
  cutoverBlockers: string[];
}

/**
 * Snapshot current process env for DB/Auth cutover decisions.
 * Safe in production: reports blockers instead of throwing.
 */
export function snapshotMicrosoftNativeRuntime(): MicrosoftNativeRuntimeSnapshot {
  const authProvider = getAuthProvider();
  const cutoverBlockers: string[] = [];

  if (authProvider === "entra") {
    if (getEntraConfig() === null) {
      cutoverBlockers.push(
        "AUTH_PROVIDER=entra but Entra External ID secrets are incomplete"
      );
    }
    const session = process.env.SESSION_SECRET ?? process.env.ENTRA_SESSION_SECRET;
    if (!session || session.length < 32) {
      cutoverBlockers.push("AUTH_PROVIDER=entra requires SESSION_SECRET (32+ chars)");
    }
  }

  if (
    authProvider === "entra" &&
    !isAzurePostgresConfigured() &&
    !isSupabaseConfigured()
  ) {
    cutoverBlockers.push("No database plane configured for Entra mode");
  }

  return {
    authProvider,
    dataPlane: resolveDataPlane(),
    azurePostgresConfigured: isAzurePostgresConfigured(),
    entraConfigured: getEntraConfig() !== null,
    supabaseConfigured: isSupabaseConfigured(),
    databaseUrlSource: databaseUrlSource(),
    preferredDatabaseUrl: getDatabaseUrl(),
    cutoverBlockers,
  };
}

/**
 * Production config can select azure/entra without crashing.
 * Temporarily overlays AUTH_PROVIDER for what-if checks, then restores.
 */
export function selectProductionAuthAndDb(options?: {
  authProvider?: AuthProvider;
}): MicrosoftNativeRuntimeSnapshot {
  const previous = process.env.AUTH_PROVIDER;
  try {
    if (options?.authProvider) {
      process.env.AUTH_PROVIDER = options.authProvider;
    }
    return snapshotMicrosoftNativeRuntime();
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_PROVIDER;
    } else {
      process.env.AUTH_PROVIDER = previous;
    }
  }
}
