import { NextResponse } from "next/server";
import { verifySupabaseConnection } from "@/lib/data/dashboard";
import { isProduction, validateProductionEnv } from "@/lib/config";

export async function GET() {
  const status = await verifySupabaseConnection();
  const missingEnv = isProduction ? validateProductionEnv() : [];
  const productionReady = status.ok && missingEnv.length === 0;

  if (isProduction) {
    return NextResponse.json(
      { status: productionReady ? "ok" : "degraded" },
      { status: productionReady ? 200 : 503 }
    );
  }

  return NextResponse.json(
    {
      ...status,
      environment: "development",
      missingEnv,
      productionReady,
    },
    { status: status.ok ? 200 : 503 }
  );
}
