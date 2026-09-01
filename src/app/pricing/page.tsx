import Link from "next/link";
import { ArrowRight, Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { STANDALONE_PRICE_MONTHLY } from "@/lib/entitlements";
import { appLoginUrl, appSignupUrl } from "@/lib/domains/links";
import { attributionFromSearchParams } from "@/lib/gtm/attribution";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Growth Command Center",
  description: `Growth Command Center standalone subscription at $${STANDALONE_PRICE_MONTHLY}/month. Active HVCG clients receive complimentary access.`,
};

const starterFeatures = [
  "Executive dashboard & 13-week cash forecast",
  "CSV, Excel, and PDF financial import",
  "AI CFO advisor with source-aware answers",
  "KPI tracking and value-creation intelligence",
  "Up to 5 team members",
  "Native connector access as certified (QuickBooks, Plaid, Stripe, and more)",
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const attribution = attributionFromSearchParams(params);
  const signupUrl = appSignupUrl(attribution);
  const loginUrl = appLoginUrl();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-bold">
            Growth Command Center
          </Link>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link href={loginUrl}>Sign in</Link>
            </Button>
            <Button asChild>
              <Link href={signupUrl}>Start free trial</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold">Simple, transparent pricing</h1>
          <p className="text-lg text-muted-foreground">
            Two ways to access Growth Command Center
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>Standalone Subscription</CardTitle>
              <CardDescription>For any founder-led or lower-middle-market business</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">${STANDALONE_PRICE_MONTHLY}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {starterFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full" asChild>
                <Link href={signupUrl}>
                  Start 14-day free trial <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                No credit card required to explore
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle>HVCG Client Access</CardTitle>
              <CardDescription>Included with your advisory engagement</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">Complimentary</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Active High Value Capital Group clients receive Growth Command Center access as part
                of their qualifying advisory engagement — at no additional software subscription charge
                while that engagement remains active.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Full platform access — same capabilities as standalone
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  No separate GCC monthly charge during active engagement
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Coordinated with your HVCG advisory team
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                HVCG advisory service fees are separate from GCC software pricing. Access is tied to
                active engagement status — not lifetime free access.
              </p>
              <Button className="w-full" variant="outline" asChild>
                <a href="https://highvaluecapitalgroup.com" target="_blank" rel="noopener noreferrer">
                  Learn about HVCG advisory
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
