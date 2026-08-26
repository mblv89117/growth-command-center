import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Plug,
  Sparkles,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONNECTOR_REGISTRY } from "@/lib/connectors/registry";
import { STANDALONE_PRICE_MONTHLY } from "@/lib/entitlements";
import { appLoginUrl, appSignupUrl } from "@/lib/domains/links";
import type { GtmAttribution } from "@/lib/gtm/attribution";

const connectorEcosystem = [
  { name: "QuickBooks", status: "Coming Soon", category: "Accounting" },
  { name: "Xero", status: "Coming Soon", category: "Accounting" },
  { name: "Plaid", status: "Coming Soon", category: "Banking" },
  { name: "Stripe", status: "Coming Soon", category: "Payments" },
  { name: "Google Sheets", status: "Coming Soon", category: "Spreadsheets" },
  { name: "HubSpot", status: "Coming Soon", category: "CRM" },
  { name: "Gusto", status: "Coming Soon", category: "Payroll" },
  { name: "CSV / Excel", status: "Live", category: "Upload" },
  { name: "PDF Reports", status: "Live", category: "Upload" },
];

export function GtmHomepage({ attribution = {} }: { attribution?: GtmAttribution }) {
  const liveUploads = CONNECTOR_REGISTRY.filter((c) => c.isProductionLive && c.category === "uploads");
  const signupUrl = appSignupUrl(attribution);
  const loginUrl = appLoginUrl();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">Growth Command Center</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link href="#how-it-works" className="text-muted-foreground hover:text-foreground">
              How it works
            </Link>
            <Link href="#connectors" className="text-muted-foreground hover:text-foreground">
              Integrations
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href={loginUrl}>Sign in</Link>
            </Button>
            <Button asChild>
              <Link href={signupUrl}>Start your command center</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-24 text-center">
          <p className="mb-4 text-sm font-medium text-primary">Financial + operating intelligence for founders</p>
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
            See your business clearly.
          </h1>
          <p className="mx-auto mb-4 max-w-2xl text-xl text-muted-foreground">
            Connect the systems you already use — or upload the financial reports you already have.
            Growth Command Center turns your business data into forecasts, KPIs, risks, opportunities,
            and clear next actions.
          </p>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
            Know what&apos;s happening in your business, what is changing, and what to do next.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href={signupUrl}>
                Start your command center <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            ${STANDALONE_PRICE_MONTHLY}/month standalone · Included for active HVCG clients
          </p>
        </section>

        {/* Two paths */}
        <section className="border-t bg-muted/30 py-20" id="how-it-works">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mb-2 text-center text-3xl font-bold">Two ways to get started</h2>
            <p className="mb-12 text-center text-muted-foreground">
              Neither path is a workaround — both are first-class.
            </p>
            <div className="grid gap-8 md:grid-cols-2">
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <Plug className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>Connect My Systems</CardTitle>
                  <CardDescription>
                    Link QuickBooks, bank accounts, Stripe, Google Sheets, and more. Data syncs
                    automatically into one trusted business model.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>· Read-only connections — we never alter your accounting</li>
                    <li>· Automatic sync with source provenance on every number</li>
                    <li>· Native connectors rolling out in waves</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <Upload className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>Upload My Data</CardTitle>
                  <CardDescription>
                    Import CSV, Excel, or PDF financial reports. Map, preview, validate, and confirm
                    before anything becomes financial truth.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>· {liveUploads.length} upload formats live today</li>
                    <li>· PDF extraction with user confirmation required</li>
                    <li>· Templates and field guidance included</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="py-20">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Wallet, title: "Cash Visibility", desc: "13-week forecast and real-time cash position" },
              { icon: BarChart3, title: "KPI Intelligence", desc: "Metrics that matter — not generic accounting jargon" },
              { icon: Sparkles, title: "AI CFO Advisor", desc: "Answers grounded in your data with source awareness" },
              { icon: TrendingUp, title: "Value Creation", desc: "Risks, opportunities, and evidence-backed actions" },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title}>
                <CardHeader>
                  <Icon className="mb-2 h-6 w-6 text-primary" />
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Connector ecosystem */}
        <section className="border-t bg-muted/30 py-20" id="connectors">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mb-2 text-center text-3xl font-bold">Your business ecosystem</h2>
            <p className="mb-12 text-center text-muted-foreground">
              Connectors are added in waves. We only mark integrations live when production-certified.
            </p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {connectorEcosystem.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.category}</p>
                  </div>
                  <Badge variant={c.status === "Live" ? "default" : "secondary"} className="text-xs">
                    {c.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HVCG cross-sell */}
        <section className="py-20">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <Building2 className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="mb-4 text-2xl font-bold">Already an HVCG client?</h2>
            <p className="text-muted-foreground">
              Growth Command Center is available as a standalone subscription for ${STANDALONE_PRICE_MONTHLY}/month.
              Active High Value Capital Group clients receive access as part of their advisory engagement
              at no additional software subscription charge while their qualifying engagement remains active.
            </p>
            <Button className="mt-6" variant="outline" asChild>
              <Link href="/pricing">View pricing & access options</Link>
            </Button>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-primary py-16 text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="mb-4 text-3xl font-bold">Ready to see your business clearly?</h2>
            <p className="mb-8 opacity-90">
              14-day free trial · No credit card required to explore
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href={signupUrl}>
                Start your command center <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Growth Command Center · High Value Capital Group LLC</p>
        <p className="mt-1">
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          {" · "}
          <a href="https://highvaluecapitalgroup.com" className="hover:underline" target="_blank" rel="noopener noreferrer">
            High Value Capital Group
          </a>
        </p>
      </footer>
    </div>
  );
}
