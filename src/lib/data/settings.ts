import {
  fetchOrganizationSettingsById,
  updateOrganizationById,
} from "@/lib/data/data-plane";

export async function persistOrganizationSettings(
  organizationId: string,
  section: string,
  settings: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const org = await fetchOrganizationSettingsById(organizationId);
  if (!org) {
    return {
      ok: false,
      message: "Organization not found.",
    };
  }

  const current = org.settings ?? {};
  const merged = { ...current, ...settings };

  const rowUpdate: Record<string, unknown> = { settings: merged };

  if (section === "organization") {
    if (typeof settings.name === "string") rowUpdate.name = settings.name;
    if (typeof settings.industry === "string") rowUpdate.industry = settings.industry;
    if (typeof settings.slug === "string") rowUpdate.slug = settings.slug;
  }

  return updateOrganizationById(organizationId, rowUpdate);
}
