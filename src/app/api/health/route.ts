import { NextResponse } from "next/server";
import { verifySupabaseConnection } from "@/lib/data/dashboard";
import { isProduction, validateProductionEnv } from "@/lib/config";
import { countRecentFailedJobRuns } from "@/lib/data/active-runtime-plane";
import { isPersistentDataBackendAvailable } from "@/lib/data/data-plane";

export async function GET() {
  const status = await verifySupabaseConnection();
  const missingEnv = isProduction ? validateProductionEnv() : [];
  const productionReady = status.ok && missingEnv.length === 0;

  let recentJobFailures = 0;
  if (isPersistentDataBackendAvailable()) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    recentJobFailures = await countRecentFailedJobRuns(since);
  }

  if (isProduction) {
    return NextResponse.json(
      {
        status: productionReady && recentJobFailures < 10 ? "ok" : "degraded",
        recentJobFailures,
      },
      { status: productionReady ? 200 : 503 }
    );
  }

  return NextResponse.json(
    {
      ...status,
      environment: "development",
      missingEnv,
      productionReady,
      recentJobFailures,
    },
    { status: status.ok ? 200 : 503 }
  );
}
