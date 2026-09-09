import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header, MobileNav, Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/lib/auth/context";
import { getAuthContext } from "@/lib/auth/api";
import { isEntraAuthEnabled } from "@/lib/auth/entra/config";
import { DEMO_MODE_COOKIE, isDemoModeAllowed, isSupabaseConfigured } from "@/lib/config";
import { getOrganizationById } from "@/lib/data/organizations";
import { createClient } from "@/lib/supabase/server";
import { TenantProvider } from "@/lib/tenant/context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const demoMode = isDemoModeAllowed() && cookieStore.get(DEMO_MODE_COOKIE)?.value === "1";
  const entraMode = isEntraAuthEnabled();

  let authContext = null;
  let supabaseSession = null;

  if (entraMode) {
    authContext = await getAuthContext();
    if (!authContext && !demoMode) {
      redirect("/login");
    }
  } else {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      supabaseSession = data.session;
    }

    if (isSupabaseConfigured() && !supabaseSession && !demoMode) {
      redirect("/login");
    }

    authContext = supabaseSession ? await getAuthContext() : null;
  }

  const serverOrganization = authContext
    ? await getOrganizationById(authContext.organizationId)
    : undefined;

  const authUser = authContext
    ? {
        id: authContext.userId,
        email: authContext.email,
        name: authContext.email?.split("@")[0] ?? null,
      }
    : supabaseSession?.user
      ? {
          id: supabaseSession.user.id,
          email: supabaseSession.user.email ?? "",
          name:
            (supabaseSession.user.user_metadata?.full_name as string | undefined) ??
            supabaseSession.user.email?.split("@")[0] ??
            null,
        }
      : null;

  return (
    <AuthProvider
      initialSession={supabaseSession}
      initialAuthUser={authUser}
      demoMode={demoMode}
    >
      <TenantProvider
        authUser={authUser}
        serverRole={authContext?.role}
        serverOrganizationId={authContext?.organizationId}
        serverOrganization={serverOrganization}
        demoMode={demoMode}
      >
        <div className="min-h-screen bg-background">
          <Sidebar />
          <div className="lg:pl-64">
            <Header />
            <MobileNav />
            <main className="p-4 lg:p-8">{children}</main>
          </div>
        </div>
      </TenantProvider>
    </AuthProvider>
  );
}
