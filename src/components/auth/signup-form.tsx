"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * GCC is not public SaaS. Self-serve signup previously attached every
 * account to the demo tenant (org-apex). That path is closed.
 */
export function SignupForm() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <ShieldAlert className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Invite only</CardTitle>
          <CardDescription>
            Growth Command Center is HVCG client-delivery intelligence after Atlas
            Active Client activation. Public signup does not create a workspace and
            cannot join the demo tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Access is mapped by HVCG after governed client activation. This page
            never assigns <code>org-apex</code> or any other client tenant.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Return to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
