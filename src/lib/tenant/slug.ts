export function slugifyCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "workspace";
}

export function organizationIdFromSlug(slug: string): string {
  return `org-${slug}`;
}

export function uniqueSlug(
  base: string,
  exists: (slug: string) => boolean | Promise<boolean>
): string | Promise<string> {
  const trySlug = async (slug: string): Promise<string> => {
    if (!(await exists(slug))) return slug;
    for (let i = 0; i < 10; i++) {
      const candidate = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      if (!(await exists(candidate))) return candidate;
    }
    return `${slug}-${Date.now().toString(36)}`;
  };
  const initial = slugifyCompanyName(base);
  const result = exists(initial);
  if (typeof result === "boolean") {
    if (!result) return initial;
    for (let i = 0; i < 10; i++) {
      const candidate = `${initial}-${Math.random().toString(36).slice(2, 6)}`;
      if (!exists(candidate)) return candidate;
    }
    return `${initial}-${Date.now().toString(36)}`;
  }
  return trySlug(initial);
}
