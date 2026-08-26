import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/pricing", "/signup", "/login"], disallow: ["/dashboard", "/api/", "/integrations", "/onboarding", "/settings"] },
    sitemap: "https://www.growthcommandcenter.com/sitemap.xml",
  };
}
