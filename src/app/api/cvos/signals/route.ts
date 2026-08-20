import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { selectOrganizationId } from "@/lib/auth/organization";
import { assertCapitalSignalGovernance, detectSignals } from "@/lib/cvos/signals";
import {
  assertGccValueSignal,
  capitalToGccValueSignal,
  toGccValueSignal,
} from "@/lib/cvos/value-signal-adapter";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requested = url.searchParams.get("organizationId");
    const access = await requireApiAccess();
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

    // CC-006: emit Integration SoT alongside local richer models (adapter, not dual SoT).
    const valueSignals = [
      ...signals.map(toGccValueSignal),
      ...capital.map(capitalToGccValueSignal),
    ];
    for (const vs of valueSignals) {
      const issues = assertGccValueSignal(vs);
      if (issues.length > 0) {
        return NextResponse.json({ error: "invalid_value_signal", issues }, { status: 500 });
      }
    }

    return NextResponse.json({
      contractVersions: {
        canonical: "gcc-value-signal.v1",
        localSource: "gcc-atlas-signal.v1",
        capital: "gcc-atlas-capital-signal.v1",
      },
      atlasCommercialAuthority: true,
      lenderOutreachStarted: false,
      copiesLedger: false,
      /** Integration SoT payloads for Atlas consumption */
      valueSignals,
      /** Local richer models retained for cockpit UI */
      signals,
      capital,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
