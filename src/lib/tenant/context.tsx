"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ORGANIZATIONS, CURRENT_USER } from "@/lib/mock-data";
import type { Organization, User, UserRole } from "@/lib/types";

/** Provider-neutral identity for TenantProvider (Entra or Supabase). */
export interface AuthUserIdentity {
  id: string;
  email: string;
  name?: string | null;
}

interface TenantContextValue {
  organization: Organization;
  user: User;
  organizations: Organization[];
  switchOrganization: (orgId: string) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function mapAuthUser(
  authUser: AuthUserIdentity,
  serverRole?: UserRole,
  serverOrganizationId?: string
): User {
  return {
    id: authUser.id,
    email: authUser.email ?? "",
    name: authUser.name?.trim() || authUser.email?.split("@")[0] || "User",
    role: serverRole ?? "founder",
    organizationId: serverOrganizationId ?? ORGANIZATIONS[0].id,
    lastActiveAt: new Date().toISOString(),
  };
}

export function TenantProvider({
  children,
  authUser,
  serverRole,
  serverOrganizationId,
  serverOrganization,
  demoMode = false,
}: {
  children: ReactNode;
  authUser?: AuthUserIdentity | null;
  serverRole?: UserRole;
  serverOrganizationId?: string;
  serverOrganization?: Organization;
  demoMode?: boolean;
}) {
  const mappedUser = authUser
    ? mapAuthUser(authUser, serverRole, serverOrganizationId)
    : { ...CURRENT_USER };

  const organization =
    serverOrganization ??
    ORGANIZATIONS.find((org) => org.id === mappedUser.organizationId) ??
    ORGANIZATIONS[0];

  const user: User = {
    ...mappedUser,
    organizationId: organization.id,
    name: demoMode && !authUser ? CURRENT_USER.name : mappedUser.name,
  };

  return (
    <TenantContext.Provider
      value={{
        organization,
        user,
        organizations: [organization],
        switchOrganization: () => undefined,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant must be used within TenantProvider");
  return context;
}
