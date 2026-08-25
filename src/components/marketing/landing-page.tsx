import Link from "next/link";
import { ArrowRight, BarChart3, Shield, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Wallet,
    title: "Cash Visibility",
    description: "Know your cash position today and where it is headed over the next 13 weeks.",
  },
  {
    icon: BarChart3,
    title: "KPI Intelligence",
    description: "Track the metrics that matter for your business — not generic accounting jargon.",
  },
  {
    icon: Sparkles,
    title: "AI CFO Advisor",
    description: "Ask questions like 'Why is cash down?' and get answers grounded in your data.",
  },
  {
    icon: Shield,
    title: "Risk & Opportunity",
    description: "Surface margin leaks, working capital gaps, and value-creation opportunities.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">Growth Command Center</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Start free trial</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <p className="mb-4 text-sm font-medium text-primary">Client Value OS for founders</p>
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Turn your financial data into
            <br />
            <span className="text-primary">cash clarity and growth decisions</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Growth Command Center helps lower-middle-market and founder-led businesses understand
            cash, forecast, KPIs, risks, and value-creation opportunities — without needing a CFO
            on staff.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start your free trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in to your workspace</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            14-day trial · Import CSV/XLSX or connect QuickBooks · No developer required
          </p>
        </section>

        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-2xl font-bold">Who it is for</h2>
              <p className="text-muted-foreground">
                Founders and executives at businesses with $1M–$50M in revenue who need CFO-grade
                visibility without CFO-grade complexity. Construction, services, SaaS, agencies,
                and professional firms.
              </p>
            </div>
            <div>
              <h2 className="mb-4 text-2xl font-bold">How to start</h2>
              <ol className="space-y-2 text-muted-foreground">
                <li>1. Create your workspace (takes 2 minutes)</li>
                <li>2. Import financial data via CSV/XLSX or connect QuickBooks</li>
                <li>3. Set your KPI targets during guided onboarding</li>
                <li>4. View your executive dashboard and ask the AI CFO questions</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <h2 className="mb-4 text-2xl font-bold">Simple, transparent pricing</h2>
            <p className="mb-8 text-muted-foreground">
              Plans start at $149/month. Start with a 14-day free trial — no credit card required
              to explore.
            </p>
            <Card className="mx-auto max-w-sm">
              <CardHeader>
                <CardTitle>Starter</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">$149</span>/month
                </CardDescription>
              </CardHeader>
              <CardContent className="text-left text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>Executive dashboard & cash forecast</li>
                  <li>CSV/XLSX import</li>
                  <li>AI CFO advisor</li>
                  <li>Up to 5 team members</li>
                </ul>
                <Button className="mt-4 w-full" asChild>
                  <Link href="/signup">Start free trial</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Growth Command Center · High Value Capital Group LLC</p>
      </footer>
    </div>
  );
}
