"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared";
import { ValueCreationInsightBanner } from "@/components/value-creation/value-creation-insight-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/lib/tenant/context";
import type { ValueCreationBoard } from "@/lib/value-creation/analyze";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight, Loader2, TrendingUp } from "lucide-react";

const confidenceColors = {
  VERIFIED: "default",
  ESTIMATED: "secondary",
  INFERRED: "outline",
} as const;

export default function ValueCreationPage() {
  const { organization } = useTenant();
  const [board, setBoard] = useState<ValueCreationBoard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/value-creation?organizationId=${organization.id}`)
      .then((res) => res.json())
      .then((data) => setBoard(data as ValueCreationBoard))
      .finally(() => setLoading(false));
  }, [organization.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Value Creation"
        description={`Value-creation opportunities for ${organization.name}`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/integrations/import">
              Import data <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <ValueCreationInsightBanner />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Verified impact</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(board?.verifiedImpact ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated impact</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(board?.estimatedImpact ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Opportunities</CardDescription>
            <CardTitle className="text-2xl">{board?.opportunities.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">{board?.summary}</p>

      <div className="space-y-4">
        {(board?.opportunities ?? []).map((opp) => (
          <Card key={opp.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{opp.finding}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Badge variant={confidenceColors[opp.confidence]}>{opp.confidence}</Badge>
                  <Badge variant={opp.priority === "high" ? "destructive" : "secondary"}>
                    {opp.priority}
                  </Badge>
                </div>
              </div>
              <CardDescription className="capitalize">{opp.category.replace("_", " ")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Evidence</p>
                <p className="text-muted-foreground">{opp.evidence}</p>
              </div>
              <div>
                <p className="font-medium">Business impact</p>
                <p className="text-muted-foreground">{opp.businessImpact}</p>
              </div>
              <div>
                <p className="font-medium">Recommended action</p>
                <p className="text-muted-foreground">{opp.recommendedAction}</p>
              </div>
              {opp.financialImpact > 0 && (
                <p className="font-medium text-primary">
                  Potential impact: {formatCurrency(opp.financialImpact)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
