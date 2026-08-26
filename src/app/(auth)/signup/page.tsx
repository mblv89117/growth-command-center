import { SignupForm } from "@/components/auth/signup-form";
import { redirectMarketingAuthToApp } from "@/lib/domains/auth-redirect";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await redirectMarketingAuthToApp("/signup", params);

  return <SignupForm />;
}
