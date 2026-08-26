"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SignupPhase = "form" | "awaiting_confirmation";

export function SignupForm() {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<SignupPhase>("form");
  const [pendingEmail, setPendingEmail] = useState("");

  const emailRedirectTo = () =>
    `${window.location.origin}/auth/callback?next=/onboarding`;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    const { data, error: authError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: name,
          company_name: companyName.trim(),
          role: "founder",
        },
        emailRedirectTo: emailRedirectTo(),
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      await fetch("/api/tenants/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });
      window.location.href = "/onboarding";
      return;
    }

    const identities = data.user?.identities ?? [];
    const likelyExistingAccount = Boolean(data.user && identities.length === 0);

    setPendingEmail(trimmedEmail);
    setPhase("awaiting_confirmation");

    if (likelyExistingAccount) {
      setMessage(
        "If you already signed up, your account may be waiting for email confirmation. Use Resend below — signing up again does not send a new email."
      );
    } else {
      setMessage("We sent a confirmation link to your email. Click it to activate your workspace.");
    }

    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!pendingEmail) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: emailRedirectTo() },
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setMessage(`Confirmation email resent to ${pendingEmail}. Check inbox and spam (sender: connect@highvaluecapitalgroup.com).`);
    }
    setLoading(false);
  };

  const handleEditEmail = () => {
    setPhase("form");
    setError(null);
    setMessage(null);
  };

  if (phase === "awaiting_confirmation") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Mail className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Confirm your email</CardTitle>
            <CardDescription>
              Account created for <span className="font-medium text-foreground">{pendingEmail}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Check your inbox and spam/promotions folders</li>
              <li>Look for email from <span className="font-medium">connect@highvaluecapitalgroup.com</span></li>
              <li>Click the confirmation link, then sign in</li>
            </ul>
            <Button className="w-full" onClick={handleResendConfirmation} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Resend confirmation email
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/login">Go to sign in</Link>
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-primary hover:underline"
              onClick={handleEditEmail}
            >
              Use a different email address
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Start your Growth Command Center workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Sarah Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                placeholder="Acme Services LLC"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
