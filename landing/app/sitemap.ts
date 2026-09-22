import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return ["", "/stomatolog-crm", "/tariflar", "/maxfiylik", "/shartlar"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly",
    priority: path === "" || path === "/stomatolog-crm" ? 1 : 0.6,
  }));
}
