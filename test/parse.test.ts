import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTraffic, parseTrendsRss } from "../src/trends/parseTrendsRss.js";
import { parseGoogleNewsRss } from "../src/sources/googleNews.js";
import { extractText } from "../src/sources/extract.js";
import { slugify, trendKey } from "../src/util.js";

const fixture = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

describe("Google Trends RSS", () => {
  it("parses trends, traffic and news items", () => {
    const trends = parseTrendsRss(fixture("trends.xml"));
    expect(trends).toHaveLength(2);
    expect(trends[0]).toMatchObject({ title: "lunar eclipse", approxTraffic: 500_000 });
    expect(trends[0].newsItems).toHaveLength(2);
    expect(trends[0].newsItems[0].title).toBe("Lunar eclipse tonight: what time & where to watch");
    expect(trends[1].newsItems).toHaveLength(1); // single news_item is not an array in XML
    expect(trends[1].approxTraffic).toBe(2000);
  });

  it("parses traffic formats", () => {
    expect(parseTraffic("200+")).toBe(200);
    expect(parseTraffic("1M+")).toBe(1_000_000);
    expect(parseTraffic("1.5K+")).toBe(1500);
    expect(parseTraffic(undefined)).toBe(0);
  });
});

describe("Google News RSS", () => {
  it("strips the outlet suffix from titles", () => {
    const items = parseGoogleNewsRss(fixture("gnews.xml"));
    expect(items[0]).toEqual({ title: "Eclipse wows skywatchers", url: "https://news.google.com/rss/articles/abc", source: "The Daily" });
  });
});

describe("helpers", () => {
  it("slugifies", () => {
    expect(slugify("Why is “Café Olé” trending?!")).toBe("why-is-cafe-ole-trending");
  });
  it("keys trends by US Eastern day", () => {
    expect(trendKey("Jets vs Bills", new Date("2026-11-25T03:00:00Z"))).toBe("2026-11-24:jets-vs-bills");
  });
  it("extracts readable text", () => {
    const para = "The eclipse will be visible across North America tonight. ".repeat(20);
    const html = `<html><head><title>t</title></head><body><nav>menu</nav><article><h1>Eclipse</h1><p>${para}</p><p>${para}</p></article></body></html>`;
    expect(extractText(html)).toContain("visible across North America");
  });
});
