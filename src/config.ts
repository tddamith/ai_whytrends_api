function num(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  geo: process.env.TRENDS_GEO ?? "US",
  maxArticlesPerRun: num(process.env.MAX_ARTICLES_PER_RUN, 4),
  publishMode: (process.env.PUBLISH_MODE === "auto" ? "auto" : "review") as "auto" | "review",
  adminToken: process.env.ADMIN_TOKEN ?? "",
  webRevalidateUrl: process.env.WEB_REVALIDATE_URL ?? "",
  webRevalidateSecret: process.env.WEB_REVALIDATE_SECRET ?? "",
  pexelsKey: process.env.PEXELS_API_KEY ?? "",
  port: num(process.env.PORT, 8787),
  models: {
    triage: "claude-haiku-5-5",
    writer: "claude-opus-5-5",
  },
  userAgent: "WhyTrendsBot/0.1 (+https://whytrends.com/about)",
};
