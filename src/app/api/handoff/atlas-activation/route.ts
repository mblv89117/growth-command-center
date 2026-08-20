import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { authErrorResponse } from "@/lib/auth/api";
import { requirePlatformAdminAccess } from "@/lib/auth/access";
import {
  assertAtlasGccActivationContract,
  type AtlasGccActivationHandoff,
} from "@/lib/handoff/atlas-activation";
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

export async function POST(req: Request) {
  try {
    await requirePlatformAdminAccess();
    const body = (await req.json()) as AtlasGccActivationHandoff;
    const issues = assertAtlasGccActivationContract(body);
    if (issues.length > 0) {
      return NextResponse.json({ error: "invalid_contract", issues }, { status: 400 });
    }
    const staged = stageAtlasGccActivation(body);
    return NextResponse.json({
      ok: true,
      created: staged.created,
      replay: !staged.created,
      provisioned: false,
      event: staged,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
