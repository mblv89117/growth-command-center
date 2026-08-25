import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, authErrorResponse } from "@/lib/auth/api";
import { provisionTenantForUser } from "@/lib/tenant/provision";

const provisionSchema = z.object({
  companyName: z.string().min(1).max(120),
  industry: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = provisionSchema.parse(await request.json());

    const result = await provisionTenantForUser({
      userId: auth.userId,
      companyName: body.companyName,
      industry: body.industry,
    });

    if (!result) {
      return NextResponse.json({ error: "Tenant provisioning unavailable" }, { status: 503 });
    }

    return NextResponse.json({
      organization: result.organization,
      created: result.created,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
