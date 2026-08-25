import { NextResponse } from "next/server";
import { verifySupabaseConnection } from "@/lib/data/dashboard";
import { isProduction, validateProductionEnv } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const status = await verifySupabaseConnection();
  const missingEnv = isProduction ? validateProductionEnv() : [];
  const productionReady = status.ok && missingEnv.length === 0;

  let recentJobFailures = 0;
  const admin = createAdminClient();
  if (admin) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("gcc_job_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("started_at", since);
    recentJobFailures = count ?? 0;
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
