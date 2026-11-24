import { config } from "../config.js";
import { closeDb } from "../db/index.js";
import * as repo from "../db/repo.js";
import { revalidateWeb } from "../api/revalidate.js";
import { triageTrend } from "../llm/triage.js";
import { writeArticle } from "../llm/write.js";
import { qualityGate } from "../quality/gate.js";
import { gatherSources } from "../sources/extract.js";
import { searchGoogleNews } from "../sources/googleNews.js";
import { findImage } from "../sources/images.js";
import { fetchTrends } from "../trends/fetchTrends.js";
import type { Trend } from "../types.js";

const MIN_SOURCES = 2;

async function processTrend(trend: Trend, trendId: number): Promise<string> {
  const triage = await triageTrend(trend);
  if (!triage) return "triage refused";
  if (!triage.worth_writing) {
    await repo.setTrendState(trendId, "skipped", triage);
    return `skipped: ${triage.reason}`;
  }

  // Direct links from the Trends feed first, then Google News search results.
  const candidates = [...trend.newsItems, ...(await searchGoogleNews(trend.title))];
  const sources = await gatherSources(candidates, 5);
  if (sources.length < MIN_SOURCES) {
    await repo.setTrendState(trendId, "new", triage); // retry on a later run when more coverage exists
    return `waiting: only ${sources.length} readable source(s)`;
  }

  const draft = await writeArticle(trend, triage, sources);
  if (!draft) {
    await repo.setTrendState(trendId, "failed", triage);
    return "writer returned nothing";
  }

  const gate = qualityGate(draft, sources, triage.sensitive);
  const status = gate.pass && config.publishMode === "auto" ? "published" : "review";
  const image = await findImage(draft.image_query).catch(() => null);
  const { slug } = await repo.insertArticle({
    trendId, draft, sources, category: triage.category, image, status, gateReasons: gate.reasons, model: config.models.writer,
  });
  await repo.setTrendState(trendId, "written", triage);
  if (status === "published") await revalidateWeb(slug);
  return `${status}: /${slug}${gate.reasons.length ? ` (${gate.reasons.join("; ")})` : ""}`;
}

export async function runPipeline() {
  const trends = await fetchTrends();
  console.log(`fetched ${trends.length} trends for ${config.geo}`);
  let written = 0;
  for (const trend of trends) {
    if (written >= config.maxArticlesPerRun) break;
    const { id, state } = await repo.upsertTrend(trend, config.geo);
    if (state !== "new") continue;
    try {
      const result = await processTrend(trend, id);
      console.log(`- ${trend.title}: ${result}`);
      if (result.startsWith("published") || result.startsWith("review")) written++;
    } catch (err) {
      console.error(`- ${trend.title}: error ${(err as Error).message}`);
      await repo.setTrendState(id, "failed");
    }
  }
  console.log(`done: ${written} article(s) written`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPipeline()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(closeDb);
}
