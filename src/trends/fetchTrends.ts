import { config } from "../config.js";
import type { Trend } from "../types.js";
import { parseTrendsRss } from "./parseTrendsRss.js";

export async function fetchTrends(geo = config.geo): Promise<Trend[]> {
  const url = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
  const res = await fetch(url, { headers: { "user-agent": config.userAgent } });
  if (!res.ok) throw new Error(`Google Trends RSS returned ${res.status}`);
  return parseTrendsRss(await res.text()).sort((a, b) => b.approxTraffic - a.approxTraffic);
}
