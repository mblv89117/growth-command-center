"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isDemoModeAllowed, isEntraClientEnabled, isProduction, isSupabaseConfigured } from "@/lib/config";
import { GccLogo } from "@/components/brand/gcc-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const entraEnabled = isEntraClientEnabled();
  const authReady = isSupabaseConfigured() || entraEnabled;
  const allowDemo = isDemoModeAllowed();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (entraEnabled) {
      const params = new URLSearchParams();
      params.set("next", redirect);
      if (email.trim()) params.set("login_hint", email.trim());
      window.location.href = `/api/auth/entra/login?${params.toString()}`;
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError(
        isProduction
          ? "Authentication is temporarily unavailable. Please try again shortly."
          : "Supabase is not configured."
      );
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    if (!supabase) {
      setError(
        isProduction
          ? "Authentication is temporarily unavailable. Please try again shortly."
          : "Supabase is not configured."
      );
      setLoading(false);
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/login`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage("Password reset link sent — check your email (and spam folder).");
    }
    setLoading(false);
  };

  const handleDemoMode = async () => {
    if (!allowDemo) return;
    setLoading(true);
    await fetch("/api/auth/demo", { method: "POST" });
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-background to-background p-4 dark:from-slate-900">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex justify-center">
            <GccLogo priority className="max-w-[260px]" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl tracking-tight">Growth Command Center</CardTitle>
            <CardDescription>Sign in to your CFO intelligence platform</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {authReady ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              {!entraEnabled && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              {!entraEnabled && (
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {entraEnabled ? "Continue with Microsoft" : "Sign In"}
              </Button>
            </form>
          ) : (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground"
              role="alert"
            >
              {isProduction ? (
                <>
                  <p className="font-medium">Sign-in is temporarily unavailable.</p>
                  <p className="mt-1 text-muted-foreground">
                    Production authentication is not fully configured. Please retry shortly or contact
                    support. Demo mode is disabled in production.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Supabase credentials are not configured in this environment. Configure{" "}
                  <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                  <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> for local development.
                </p>
              )}
            </div>
          )}

          {allowDemo && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={handleDemoMode} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enter Demo Mode
              </Button>
            </>
          )}

          {authReady && (
            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Create one
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
