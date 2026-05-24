import { Suspense } from "react";
import IntegrationsContent from "./integrations-content";

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading integrations...</div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
