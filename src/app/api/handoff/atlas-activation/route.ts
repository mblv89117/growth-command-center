import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { AuthError, authErrorResponse } from "@/lib/auth/api";
import { requirePlatformAdminAccess } from "@/lib/auth/access";
import {
  assertAtlasGccActivationContract,
  type AtlasGccActivationHandoff,
} from "@/lib/handoff/atlas-activation";
import { verifyAtlasHandoffAttestation } from "@/lib/handoff/attestation";
import { listAtlasGccActivations, stageAtlasGccActivation } from "@/lib/handoff/store";

export async function GET() {
  try {
    await requirePlatformAdminAccess();
    return NextResponse.json({
      contractVersion: "atlas-gcc-client-activation.v1",
      autoProvisionAccess: false,
      events: listAtlasGccActivations(),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

/**
 * GCC-RT-07: accept either
 * 1) valid Atlas HMAC service attestation, or
 * 2) authenticated platform_admin session.
 * Unsigned machine POSTs are rejected.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const attestation = verifyAtlasHandoffAttestation({
      rawBody,
      timestampHeader: req.headers.get("x-atlas-gcc-timestamp"),
      signatureHeader: req.headers.get("x-atlas-gcc-signature"),
    });

    let authMode: "hmac" | "platform_admin";
    if (attestation.ok) {
      authMode = "hmac";
    } else {
      try {
        await requirePlatformAdminAccess();
        authMode = "platform_admin";
      } catch {
        return NextResponse.json(
          {
            error: "handoff_attestation_required",
            reason: attestation.reason,
            hint: "Provide X-Atlas-Gcc-Timestamp + X-Atlas-Gcc-Signature HMAC, or authenticate as platform_admin",
          },
          { status: 401 },
        );
      }
    }

    let body: AtlasGccActivationHandoff;
    try {
      body = JSON.parse(rawBody) as AtlasGccActivationHandoff;
    } catch {
      throw new AuthError("Invalid JSON body", 400);
    }

    const issues = assertAtlasGccActivationContract(body);
    if (issues.length > 0) {
      return NextResponse.json({ error: "invalid_contract", issues }, { status: 400 });
    }
    if (body.governance.autoProvisionAccess !== false) {
      return NextResponse.json({ error: "auto_provision_forbidden" }, { status: 400 });
    }

    const staged = stageAtlasGccActivation(body);
    return NextResponse.json({
      ok: true,
      created: staged.created,
      replay: !staged.created,
      provisioned: false,
      authMode,
      event: staged,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
