import { getPlatformTenantDirectory } from "@/lib/admin/platform-tenants";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  const directory = await getPlatformTenantDirectory();

  if (!directory) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <h1 className="text-lg font-semibold">Platform Admin unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unable to load live tenant directory. Verify Supabase service role configuration and billing migrations.
        </p>
      </div>
    );
  }

  return <AdminDashboard directory={directory} />;
}
