import type { UserRole } from "@/lib/types";

/** Organization roles that may be assigned via team invite (never platform_admin). */
export const INVITABLE_ROLES = [
  "founder",
  "cfo",
  "operations",
  "sales",
  "project_manager",
  "admin",
  "staff",
  "advisor",
] as const satisfies readonly UserRole[];

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

const USER_ROLES: UserRole[] = [
  "founder",
  "cfo",
  "operations",
  "sales",
  "project_manager",
  "admin",
  "staff",
  "advisor",
  "platform_admin",
];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function isInvitableRole(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}

export const INVITABLE_ROLE_LABELS: Record<InvitableRole, string> = {
  founder: "Founder / CEO",
  cfo: "CFO / Controller",
  operations: "Operations Manager",
  sales: "Sales Manager",
  project_manager: "Project Manager",
  admin: "Admin",
  staff: "Staff",
  advisor: "External Advisor",
};
