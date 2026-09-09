/**
 * Server-only Atlas Hub module-ingest configuration.
 * Never expose secrets via NEXT_PUBLIC_*.
 */

export type GccHubIngestEnvConfig = {
  hubBaseUrl: string;
  moduleIngestKey: string;
  moduleIngestKeyId: string;
};

export function getGccHubIngestConfig(): GccHubIngestEnvConfig | null {
  const hubBaseUrl = (
    process.env.ATLAS_HUB_BASE_URL ||
    process.env.ATLAS_INTEGRATION_HUB_URL ||
    ''
  ).trim();
  const moduleIngestKey = (
    process.env.ATLAS_MODULE_INGEST_KEY ||
    process.env.INTEGRATION_MODULE_INGEST_KEY ||
    ''
  ).trim();
  const moduleIngestKeyId = (
    process.env.ATLAS_MODULE_INGEST_KEY_ID ||
    process.env.INTEGRATION_MODULE_INGEST_KEY_ID ||
    'gcc'
  ).trim();

  if (!hubBaseUrl || !moduleIngestKey || moduleIngestKey.length < 32) {
    return null;
  }
  if (hubBaseUrl.startsWith('NEXT_PUBLIC_')) return null;
  return { hubBaseUrl, moduleIngestKey, moduleIngestKeyId };
}
