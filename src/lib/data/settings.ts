import { createAdminClient } from "@/lib/supabase/admin";

export async function persistOrganizationSettings(
  organizationId: string,
  section: string,
  settings: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      message: "Database admin client is not configured.",
    };
  }

  const { data: org, error: fetchError } = await admin
    .from("gcc_organizations")
    .select("settings")
    .eq("id", organizationId)
    .single();

  if (fetchError || !org) {
    return {
      ok: false,
      message: fetchError?.message ?? "Organization not found.",
    };
  }

  const current = (org.settings as Record<string, unknown>) ?? {};
  const merged = { ...current, ...settings };

  const rowUpdate: Record<string, unknown> = { settings: merged };

  if (section === "organization") {
    if (typeof settings.name === "string") rowUpdate.name = settings.name;
    if (typeof settings.industry === "string") rowUpdate.industry = settings.industry;
    if (typeof settings.slug === "string") rowUpdate.slug = settings.slug;
  }

  const { error: updateError } = await admin
    .from("gcc_organizations")
    .update(rowUpdate)
    .eq("id", organizationId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  return { ok: true };
}
