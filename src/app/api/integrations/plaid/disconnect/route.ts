import { NextResponse } from "next/server";
import { disconnectPlaid } from "@/lib/integrations/plaid";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const ok = await disconnectPlaid(organizationId);
    return NextResponse.json({ success: ok });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Disconnect failed" },
      { status: 500 }
    );
  }
}
