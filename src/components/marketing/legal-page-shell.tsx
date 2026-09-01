import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appLoginUrl, appSignupUrl } from "@/lib/domains/links";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  const loginUrl = appLoginUrl();
  const signupUrl = appSignupUrl();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">Growth Command Center</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href={loginUrl}>Sign in</Link>
            </Button>
            <Button asChild>
              <Link href={signupUrl}>Start free trial</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>
        <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-p:text-muted-foreground prose-li:text-muted-foreground">
          {children}
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}
