import { XMLParser } from "fast-xml-parser";
import type { NewsItem, Trend } from "../types.js";

const parser = new XMLParser({ ignoreAttributes: true, processEntities: true, htmlEntities: true });

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** "200+", "2,000+", "50K+", "1M+" -> number */
export function parseTraffic(raw: unknown): number {
  const s = String(raw ?? "").replace(/[,+\s]/g, "").toUpperCase();
  const m = s.match(/^(\d+(?:\.\d+)?)([KM])?$/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Math.round(m[2] === "M" ? n * 1_000_000 : m[2] === "K" ? n * 1_000 : n);
}

/** Parses the Google Trends "Trending now" RSS feed (trends.google.com/trending/rss?geo=US). */
export function parseTrendsRss(xml: string): Trend[] {
  const doc = parser.parse(xml);
  const items = asArray(doc?.rss?.channel?.item);
  return items
    .map((it: any): Trend => ({
      title: String(it.title ?? "").trim(),
      approxTraffic: parseTraffic(it["ht:approx_traffic"]),
      publishedAt: new Date(it.pubDate ?? Date.now()),
      newsItems: asArray(it["ht:news_item"])
        .map((n: any): NewsItem => ({
          title: String(n["ht:news_item_title"] ?? "").trim(),
          url: String(n["ht:news_item_url"] ?? "").trim(),
          source: String(n["ht:news_item_source"] ?? "").trim(),
          picture: n["ht:news_item_picture"] ? String(n["ht:news_item_picture"]) : undefined,
        }))
        .filter((n) => n.url.startsWith("http")),
    }))
    .filter((t) => t.title.length > 0);
}
