import type { ArticleDraft } from "../llm/write.js";
import type { Triage } from "../llm/triage.js";
import type { LicensedImage } from "../sources/images.js";
import type { ArticleStatus, SourceDoc, Trend } from "../types.js";
import { slugify, trendKey } from "../util.js";
import { db } from "./index.js";

export const PUBLIC_COLUMNS = [
  "slug", "headline", "dek", "why_trending", "body_markdown", "key_facts", "sources", "tags",
  "category", "image_url", "image_credit", "image_credit_url", "published_at", "updated_at",
] as const;

/** Inserts or refreshes a trend; returns its id and whether it still needs work. */
export async function upsertTrend(t: Trend, geo: string): Promise<{ id: number; state: string }> {
  const [row] = await db()`
    insert into trends (key, title, geo, approx_traffic)
    values (${trendKey(t.title, t.publishedAt)}, ${t.title}, ${geo}, ${t.approxTraffic})
    on conflict (key) do update set last_seen_at = now(),
      approx_traffic = greatest(trends.approx_traffic, excluded.approx_traffic)
    returning id, state`;
  return { id: Number(row.id), state: row.state as string };
}

export async function setTrendState(id: number, state: string, triage?: Triage | null) {
  await db()`update trends set state = ${state}, triage = coalesce(${triage ? db().json(triage) : null}, triage) where id = ${id}`;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base) || "story";
  for (let i = 2; ; i++) {
    const [hit] = await db()`select 1 from articles where slug = ${slug}`;
    if (!hit) return slug;
    slug = `${slugify(base)}-${i}`;
  }
}

export async function insertArticle(args: {
  trendId: number;
  draft: ArticleDraft;
  sources: SourceDoc[];
  category: string;
  image: LicensedImage | null;
  status: ArticleStatus;
  gateReasons: string[];
  model: string;
}): Promise<{ id: number; slug: string }> {
  const { draft, sources } = args;
  const used = new Set(draft.sources_used);
  const sourceList = sources
    .map((s, i) => ({ n: i + 1, outlet: s.source, title: s.title, url: s.url }))
    .filter((s) => used.has(s.n));
  const slug = await uniqueSlug(draft.headline);
  const [row] = await db()`
    insert into articles (trend_id, slug, headline, dek, why_trending, body_markdown, key_facts, sources, tags,
      category, image_url, image_credit, image_credit_url, status, gate_reasons, model, published_at)
    values (${args.trendId}, ${slug}, ${draft.headline}, ${draft.dek}, ${draft.why_trending}, ${draft.body_markdown},
      ${db().json(draft.key_facts)}, ${db().json(sourceList)}, ${draft.tags.map((t) => t.toLowerCase())},
      ${args.category}, ${args.image?.url ?? null}, ${args.image?.credit ?? null}, ${args.image?.creditUrl ?? null},
      ${args.status}, ${args.gateReasons}, ${args.model}, ${args.status === "published" ? new Date() : null})
    returning id, slug`;
  return { id: Number(row.id), slug: row.slug as string };
}

export async function listPublished(opts: { limit: number; offset: number; category?: string }) {
  const sql = db();
  return sql`
    select ${sql(PUBLIC_COLUMNS as unknown as string[])} from articles
    where status = 'published' ${opts.category ? sql`and category = ${opts.category}` : sql``}
    order by published_at desc limit ${opts.limit} offset ${opts.offset}`;
}

export async function getPublished(slug: string) {
  const sql = db();
  const [row] = await sql`
    select ${sql(PUBLIC_COLUMNS as unknown as string[])} from articles where slug = ${slug} and status = 'published'`;
  return row ?? null;
}

export async function currentTrends(limit: number) {
  return db()`
    select t.title, t.approx_traffic, t.last_seen_at, a.slug, a.category, a.why_trending
    from trends t left join lateral (
      select slug, category, why_trending from articles
      where trend_id = t.id and status = 'published' order by published_at desc limit 1
    ) a on true
    where t.last_seen_at > now() - interval '24 hours'
    order by t.approx_traffic desc, t.last_seen_at desc limit ${limit}`;
}

export async function reviewQueue() {
  return db()`
    select id, slug, headline, dek, why_trending, body_markdown, key_facts, sources, category,
      image_url, gate_reasons, created_at
    from articles where status = 'review' order by created_at desc`;
}

export async function setArticleStatus(id: number, status: ArticleStatus) {
  const [row] = await db()`
    update articles set status = ${status}, updated_at = now(),
      published_at = case when ${status} = 'published' then coalesce(published_at, now()) else published_at end
    where id = ${id} returning slug`;
  return (row?.slug as string | undefined) ?? null;
}

export async function updateArticleText(id: number, patch: { headline?: string; dek?: string; body_markdown?: string; why_trending?: string }) {
  const sql = db();
  const fields = Object.fromEntries(Object.entries(patch).filter(([, v]) => typeof v === "string"));
  if (Object.keys(fields).length === 0) return;
  await sql`update articles set ${sql(fields)}, updated_at = now() where id = ${id}`;
}
