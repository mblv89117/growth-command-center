import { NextResponse } from "next/server";
import { syncPlaidBalances } from "@/lib/integrations/plaid";
import { recordSyncResult } from "@/lib/integrations/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const result = await syncPlaidBalances(organizationId);
    recordSyncResult(organizationId, "plaid", result);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
