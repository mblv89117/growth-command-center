"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/lib/tenant/context";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";

interface AiAdvisorPanelProps {
  department?: "executive" | "finance" | "sales" | "operations";
  className?: string;
}

export function AiAdvisorPanel({ department = "executive", className }: AiAdvisorPanelProps) {
  const { organization } = useTenant();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          department,
        }),
      });

      const data = (await res.json()) as { insights?: string; error?: string };

      if (!res.ok) {
        setInsights(null);
        setError(data.error ?? "AI Advisor request failed");
        return;
      }

      setInsights(data.insights ?? null);
    } catch {
      setInsights(null);
      setError("Unable to reach AI Advisor. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen && !insights && !loading) {
      await fetchInsights();
    }
  };

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Advisor
            </CardTitle>
            <CardDescription>
              Executive insights on cash, margin, revenue risk, and priority actions
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={open ? "secondary" : "default"}
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                AI Advisor
                {open ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 border-t pt-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {insights && !error && (
            <div className="rounded-lg bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {insights}
            </div>
          )}

          {!loading && !insights && !error && (
            <p className="text-sm text-muted-foreground">
              Open AI Advisor to generate tenant-scoped executive insights.
            </p>
          )}

          {open && !loading && (
            <Button type="button" variant="outline" size="sm" onClick={fetchInsights}>
              Refresh insights
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
