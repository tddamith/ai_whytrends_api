import { XMLParser } from "fast-xml-parser";
import { config } from "../config.js";
import type { NewsItem } from "../types.js";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export function parseGoogleNewsRss(xml: string): NewsItem[] {
  const items = parser.parse(xml)?.rss?.channel?.item ?? [];
  return (Array.isArray(items) ? items : [items]).map((it: any) => {
    const source = typeof it.source === "object" ? String(it.source["#text"] ?? "") : String(it.source ?? "");
    const title = String(it.title ?? "").replace(new RegExp(`\\s+-\\s+${escapeRe(source)}$`), "");
    return { title, url: String(it.link ?? ""), source };
  });
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Recent coverage of a query from Google News (last 24h, US English). */
export async function searchGoogleNews(query: string): Promise<NewsItem[]> {
  const q = encodeURIComponent(`${query} when:1d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, { headers: { "user-agent": config.userAgent } });
  if (!res.ok) return [];
  return parseGoogleNewsRss(await res.text());
}
