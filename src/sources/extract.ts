import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { config } from "../config.js";
import type { NewsItem, SourceDoc } from "../types.js";

const MAX_CHARS = 12_000;

export function extractText(html: string): string {
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  const text = (article?.textContent ?? "").replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return text.slice(0, MAX_CHARS);
}

async function fetchOne(item: NewsItem): Promise<SourceDoc | null> {
  try {
    const res = await fetch(item.url, {
      headers: { "user-agent": config.userAgent, accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    const text = extractText(await res.text());
    if (text.length < 400) return null; // paywall, consent wall or video page
    return { url: res.url || item.url, source: item.source, title: item.title, text };
  } catch {
    return null;
  }
}

/** Fetches up to `max` readable articles, one per outlet. */
export async function gatherSources(items: NewsItem[], max = 5): Promise<SourceDoc[]> {
  const seen = new Set<string>();
  const unique = items.filter((i) => {
    const key = i.source.toLowerCase() || new URL(i.url).hostname;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const docs = await Promise.all(unique.slice(0, max + 3).map(fetchOne));
  return docs.filter((d): d is SourceDoc => d !== null).slice(0, max);
}
