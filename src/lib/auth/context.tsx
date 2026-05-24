"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/config";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isDemoMode: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialSession,
  demoMode = false,
}: {
  children: ReactNode;
  initialSession?: Session | null;
  demoMode?: boolean;
}) {
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const [isDemoMode, setIsDemoMode] = useState(demoMode);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (isDemoMode) {
      await fetch("/api/auth/demo", { method: "DELETE" });
      setIsDemoMode(false);
      window.location.href = "/login";
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
        user: session?.user ?? null,
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
