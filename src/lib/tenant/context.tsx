"use client";

import { createContext, useContext, type ReactNode } from "react";
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
    organizationId: serverOrganizationId ?? ((metadata.organization_id as string) ?? ""),
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
  authUser?: SupabaseUser | null;
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
    (demoMode && !authUser
      ? ORGANIZATIONS[0]
      : {
          id: mappedUser.organizationId || "org-unassigned",
          name: "Unassigned workspace",
          slug: "unassigned",
          industry: "",
          plan: "starter" as const,
          createdAt: new Date().toISOString(),
          settings: {
            cashAlertThreshold: 0,
            forecastHorizonWeeks: 13,
            fiscalYearStart: 1,
            currency: "USD",
          },
        });

  const user: User = {
    ...mappedUser,
    organizationId: mappedUser.organizationId || organization.id,
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
