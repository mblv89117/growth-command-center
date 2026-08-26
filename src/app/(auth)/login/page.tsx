import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { redirectMarketingAuthToApp } from "@/lib/domains/auth-redirect";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await redirectMarketingAuthToApp("/login", params);

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
