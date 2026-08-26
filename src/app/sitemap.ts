import type { MetadataRoute } from "next";
import { getPrimaryPublicUrl } from "@/lib/domains";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPrimaryPublicUrl();
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];
}
