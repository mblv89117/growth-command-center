import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { selectOrganizationId } from "@/lib/auth/organization";
import { assertCapitalSignalGovernance, detectSignals } from "@/lib/cvos/signals";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requested = url.searchParams.get("organizationId");
    const access = await requireApiAccess({ organizationId: requested });
    requirePermission(access, "dashboard:read");

    const selected = selectOrganizationId({
      authOrganizationId: access.organizationId,
      requestedOrganizationId: requested,
      role: access.role,
    });
    if (selected.denied) {
      return NextResponse.json({ error: selected.reason ?? "forbidden" }, { status: 403 });
    }

    const { signals, capital } = detectSignals(selected.organizationId);
    for (const c of capital) {
      const issues = assertCapitalSignalGovernance(c);
      if (issues.length > 0) {
        return NextResponse.json({ error: "invalid_capital_signal", issues }, { status: 500 });
      }
    }

    return NextResponse.json({
      contractVersions: {
        signals: "gcc-atlas-signal.v1",
        capital: "gcc-atlas-capital-signal.v1",
      },
      atlasCommercialAuthority: true,
      lenderOutreachStarted: false,
      signals,
      capital,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
