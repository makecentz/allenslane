import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://allens-lane-art-center-clone.ecomexperts.chatgpt.site";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/staff/", "/account/"] }],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
