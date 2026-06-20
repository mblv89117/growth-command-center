"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/context";
import { getTenantData } from "@/lib/mock-data";
import type { TenantData } from "@/lib/types";

export function useTenantData() {
  const { organization } = useTenant();
  const [data, setData] = useState<TenantData>(() => getTenantData(organization.id));
  const [source, setSource] = useState<"supabase" | "mock">("mock");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tenant?organizationId=${organization.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Tenant API ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json.data) {
          setData(json.data);
          setSource(json.source ?? "mock");
        }
      })
      .catch(() => setData(getTenantData(organization.id)))
      .finally(() => setLoading(false));
  }, [organization.id]);

  return { data, source, loading };
}
