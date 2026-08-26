"use client";

import Link from "next/link";
import { ArrowRight, Plug, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DataConnectionChoiceProps {
  onLater?: () => void;
}

export function DataConnectionChoice({ onLater }: DataConnectionChoiceProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">How would you like to add your business data?</h2>
        <p className="mt-2 text-muted-foreground">
          Connect the systems you already use — or upload the reports you already have.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/30 transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Connect My Systems</CardTitle>
            <CardDescription>
              QuickBooks, Plaid, Stripe, Google Sheets, and more — sync automatically when available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/integrations">
                Browse connectors <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/30 transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Upload My Data</CardTitle>
            <CardDescription>
              CSV, Excel, or PDF financial reports — map, preview, and confirm before anything goes live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/integrations/import">
                Import files <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/integrations/import?type=pdf">Upload PDF report</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {onLater && (
        <div className="text-center">
          <Button variant="ghost" onClick={onLater}>
            I&apos;ll do this later
          </Button>
        </div>
      )}
    </div>
  );
}
