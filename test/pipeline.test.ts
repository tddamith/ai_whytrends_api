import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

// Integration test: needs a throwaway Postgres in TEST_DATABASE_URL (migrated). Skipped otherwise.
const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.PUBLISH_MODE = "auto";
}

const fixture = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const para = (w: string) => `<p>${`${w} reported details about the event that many people searched for today. `.repeat(12)}</p>`;

vi.mock("../src/llm/triage.js", () => ({
  triageTrend: vi.fn(async (t: { title: string }) => ({
    worth_writing: t.title === "lunar eclipse",
    category: "science",
    sensitive: false,
    angle: "why",
    reason: t.title === "lunar eclipse" ? "clear story" : "just a score",
  })),
}));
vi.mock("../src/llm/write.js", () => ({
  writeArticle: vi.fn(async () => ({
    headline: "Why everyone is searching for the lunar eclipse",
    dek: "A total eclipse is visible across the US.",
    why_trending: "A total lunar eclipse is visible across the US early Wednesday, so millions are looking up viewing times.",
    body_markdown: Array.from({ length: 45 }, (_, i) => `Line ${i} gives fresh context on tonight's eclipse.`).join(" "),
    key_facts: [1, 2, 3].map((i) => ({ fact: `fact ${i}`, source_numbers: [1, 2] })),
    sources_used: [1, 2],
    tags: ["space"],
    image_query: "full moon",
  })),
}));

describe.skipIf(!url)("pipeline run", () => {
  afterAll(async () => {
    const { closeDb } = await import("../src/db/index.js");
    await closeDb();
  });

  it("writes one article, skips the thin trend, and is idempotent", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const u = String(input);
      if (u.includes("trends.google.com")) return new Response(fixture("trends.xml"));
      if (u.includes("news.google.com")) return new Response("<rss><channel></channel></rss>");
      return new Response(`<html><body><article><h1>x</h1>${para(new URL(u).hostname)}</article></body></html>`, {
        headers: { "content-type": "text/html" },
      });
    }));
    const { db } = await import("../src/db/index.js");
    await db()`truncate articles, trends restart identity cascade`;
    const { runPipeline } = await import("../src/pipeline/run.js");

    await runPipeline();
    const arts = await db()`select slug, status, sources from articles`;
    expect(arts).toHaveLength(1);
    expect(arts[0].status).toBe("published");
    expect(arts[0].sources).toHaveLength(2);
    const states = await db()`select title, state from trends order by title`;
    expect(states.map((r) => r.state)).toEqual(["skipped", "written"]);

    await runPipeline(); // second run: nothing new
    expect(await db()`select count(*)::int as n from articles`).toEqual([{ n: 1 }]);
  });
});
