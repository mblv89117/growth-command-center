"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { ORGANIZATIONS, CURRENT_USER } from "@/lib/mock-data";
import type { Organization, User, UserRole } from "@/lib/types";

interface TenantContextValue {
  organization: Organization;
  user: User;
  organizations: Organization[];
  switchOrganization: (orgId: string) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function mapAuthUser(
  authUser: SupabaseUser,
  serverRole?: UserRole,
  serverOrganizationId?: string
): User {
  const metadata = authUser.user_metadata ?? {};
  return {
    id: authUser.id,
    email: authUser.email ?? "",
    name: (metadata.full_name as string) ?? authUser.email?.split("@")[0] ?? "User",
    role: serverRole ?? ((metadata.role as UserRole) ?? "founder"),
    organizationId: serverOrganizationId ?? ((metadata.organization_id as string) ?? ORGANIZATIONS[0].id),
    lastActiveAt: new Date().toISOString(),
  };
}

export function TenantProvider({
  children,
  authUser,
  serverRole,
  serverOrganizationId,
  demoMode = false,
}: {
  children: ReactNode;
  authUser?: SupabaseUser | null;
  serverRole?: UserRole;
  serverOrganizationId?: string;
  demoMode?: boolean;
}) {
  const mappedUser = authUser
    ? mapAuthUser(authUser, serverRole, serverOrganizationId)
    : { ...CURRENT_USER };
  const [organization, setOrganization] = useState(
    ORGANIZATIONS.find((o) => o.id === mappedUser.organizationId) ?? ORGANIZATIONS[0]
  );

  const switchOrganization = (orgId: string) => {
    const org = ORGANIZATIONS.find((o) => o.id === orgId);
    if (org) setOrganization(org);
  };

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
        organizations: ORGANIZATIONS,
        switchOrganization,
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
