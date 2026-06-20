import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header, MobileNav, Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/lib/auth/context";
import { TenantProvider } from "@/lib/tenant/context";
import { DEMO_MODE_COOKIE, isDemoModeAllowed, isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const demoMode = isDemoModeAllowed() && cookieStore.get(DEMO_MODE_COOKIE)?.value === "1";

  const supabase = await createClient();
  let session = null;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    session = data.session;
  }

  if (isSupabaseConfigured() && !session && !demoMode) {
    redirect("/login");
  }

  return (
    <AuthProvider initialSession={session} demoMode={demoMode}>
      <TenantProvider authUser={session?.user ?? null} demoMode={demoMode}>
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
