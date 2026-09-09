import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserTenant } from "@/lib/tenant/provision";
import { isEntraAuthEnabled } from "@/lib/auth/entra/config";
import { handleEntraCallback } from "@/lib/auth/entra/callback";

export async function GET(request: NextRequest) {
  if (isEntraAuthEnabled()) {
    return handleEntraCallback(request);
  }

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await ensureUserTenant(user.id, user.user_metadata ?? {});
        }
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
