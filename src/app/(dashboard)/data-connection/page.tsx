"use client";

import { PageHeader } from "@/components/shared";
import { DataConnectionChoice } from "@/components/connectors/data-connection-choice";
import { useRouter } from "next/navigation";

export default function DataConnectionPage() {
  const router = useRouter();

  return (
    <div>
      <PageHeader
        title="Add Your Business Data"
        description="Choose how to connect your financial and operating information"
      />
      <DataConnectionChoice onLater={() => router.push("/dashboard")} />
    </div>
  );
}
