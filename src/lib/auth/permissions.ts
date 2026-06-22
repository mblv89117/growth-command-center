import type { UserRole } from "@/lib/types";

export type Permission =
  | "dashboard:read"
  | "financials:read"
  | "financials:write"
  | "forecast:read"
  | "forecast:write"
  | "integrations:manage"
  | "team:manage"
  | "settings:manage"
  | "admin:access"
  | "reports:read"
  | "reports:export";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  founder: [
    "dashboard:read", "financials:read", "financials:write",
    "forecast:read", "forecast:write", "integrations:manage",
    "team:manage", "settings:manage", "admin:access",
    "reports:read", "reports:export",
  ],
  cfo: [
    "dashboard:read", "financials:read", "financials:write",
    "forecast:read", "forecast:write", "integrations:manage",
    "team:manage", "settings:manage", "reports:read", "reports:export",
  ],
  operations: ["dashboard:read", "financials:read", "forecast:read", "reports:read"],
  sales: ["dashboard:read", "forecast:read", "reports:read"],
  project_manager: ["dashboard:read", "financials:read", "forecast:read", "reports:read"],
  admin: [
    "dashboard:read", "financials:read", "team:manage", "settings:manage", "reports:read",
  ],
  staff: ["dashboard:read", "financials:read", "reports:read"],
  advisor: ["dashboard:read", "financials:read", "forecast:read", "reports:read", "reports:export"],
  platform_admin: [
    "dashboard:read", "financials:read", "financials:write",
    "forecast:read", "forecast:write", "integrations:manage",
    "team:manage", "settings:manage", "admin:access",
    "reports:read", "reports:export",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAccessAdmin(role: UserRole): boolean {
  return hasPermission(role, "admin:access");
}

export function canManageIntegrations(role: UserRole): boolean {
  return hasPermission(role, "integrations:manage");
}
