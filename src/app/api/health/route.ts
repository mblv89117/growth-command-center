import { NextResponse } from "next/server";
import { verifySupabaseConnection } from "@/lib/data/dashboard";
import { isProduction, validateProductionEnv } from "@/lib/config";

export async function GET() {
  const status = await verifySupabaseConnection();
  const missingEnv = isProduction ? validateProductionEnv() : [];

  return NextResponse.json(
    {
      ...status,
      environment: isProduction ? "production" : "development",
      missingEnv,
      productionReady: status.ok && missingEnv.length === 0,
    },
    { status: status.ok ? 200 : 503 }
  );
}
