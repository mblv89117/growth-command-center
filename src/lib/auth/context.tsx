"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isEntraClientEnabled, isSupabaseConfigured } from "@/lib/config";
import type { AuthUserIdentity } from "@/lib/tenant/context";

interface AuthContextValue {
  session: Session | null;
  user: User | AuthUserIdentity | null;
  isLoading: boolean;
  isDemoMode: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialSession,
  initialAuthUser,
  demoMode = false,
}: {
  children: ReactNode;
  initialSession?: Session | null;
  /** Provider-neutral user for Entra (or when Session shape is unavailable). */
  initialAuthUser?: AuthUserIdentity | null;
  demoMode?: boolean;
}) {
  const entraClient = isEntraClientEnabled();
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [authUser, setAuthUser] = useState<AuthUserIdentity | null>(initialAuthUser ?? null);
  const [isLoading, setIsLoading] = useState(!entraClient && isSupabaseConfigured());
  const [isDemoMode, setIsDemoMode] = useState(demoMode);

  useEffect(() => {
    if (entraClient) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthUser(
        nextSession?.user
          ? {
              id: nextSession.user.id,
              email: nextSession.user.email ?? "",
              name:
                (nextSession.user.user_metadata?.full_name as string | undefined) ??
                nextSession.user.email?.split("@")[0] ??
                null,
            }
          : null
      );
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [entraClient]);

  const signOut = async () => {
    if (isDemoMode) {
      await fetch("/api/auth/demo", { method: "DELETE" });
      setIsDemoMode(false);
      window.location.href = "/login";
      return;
    }

    if (entraClient) {
      window.location.href = "/api/auth/entra/logout";
      return;
    }

    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? authUser,
        isLoading,
        isDemoMode,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
