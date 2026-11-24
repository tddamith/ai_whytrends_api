import { Hono } from "hono";
import { cors } from "hono/cors";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import * as repo from "../db/repo.js";
import { revalidateWeb } from "./revalidate.js";
import { camel } from "./serialize.js";

export const app = new Hono();

app.use("/*", cors({ origin: "*", allowMethods: ["GET"] }));

const clamp = (v: string | undefined, d: number, max: number) => Math.min(Math.max(Number(v) || d, 0), max);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/articles", async (c) => {
  const rows = await repo.listPublished({
    limit: clamp(c.req.query("limit"), 20, 50),
    offset: clamp(c.req.query("offset"), 0, 10_000),
    category: c.req.query("category") || undefined,
  });
  c.header("cache-control", "public, max-age=60, s-maxage=300");
  return c.json({ articles: rows.map(camel) });
});

app.get("/articles/:slug", async (c) => {
  const row = await repo.getPublished(c.req.param("slug"));
  if (!row) return c.json({ error: "not_found" }, 404);
  c.header("cache-control", "public, max-age=60, s-maxage=600");
  return c.json({ article: camel(row) });
});

app.get("/trends", async (c) => {
  const rows = await repo.currentTrends(clamp(c.req.query("limit"), 20, 50));
  c.header("cache-control", "public, max-age=60, s-maxage=300");
  return c.json({ trends: rows.map(camel) });
});

// ---- admin (review queue) ----
const admin = new Hono();
admin.use("/*", async (c, next) => {
  const given = Buffer.from((c.req.header("authorization") ?? "").replace(/^Bearer /, ""));
  const want = Buffer.from(config.adminToken);
  if (!config.adminToken || given.length !== want.length || !timingSafeEqual(given, want)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

admin.get("/queue", async (c) => c.json({ articles: (await repo.reviewQueue()).map(camel) }));

admin.post("/articles/:id/approve", async (c) => {
  const slug = await repo.setArticleStatus(Number(c.req.param("id")), "published");
  if (!slug) return c.json({ error: "not_found" }, 404);
  await revalidateWeb(slug);
  return c.json({ ok: true, slug });
});

admin.post("/articles/:id/reject", async (c) => {
  const slug = await repo.setArticleStatus(Number(c.req.param("id")), "rejected");
  if (!slug) return c.json({ error: "not_found" }, 404);
  await revalidateWeb(slug);
  return c.json({ ok: true });
});

admin.patch("/articles/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  await repo.updateArticleText(Number(c.req.param("id")), {
    headline: body.headline, dek: body.dek, body_markdown: body.bodyMarkdown, why_trending: body.whyTrending,
  });
  return c.json({ ok: true });
});

app.route("/admin", admin);
