import type { MetadataRoute } from "next";
import { getAppUrl, getPrimaryPublicUrl } from "@/lib/domains";

export default function sitemap(): MetadataRoute.Sitemap {
  const marketingBase = getPrimaryPublicUrl();
  const appBase = getAppUrl();

  return [
    { url: marketingBase, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    {
      url: `${marketingBase}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${appBase}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${appBase}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
