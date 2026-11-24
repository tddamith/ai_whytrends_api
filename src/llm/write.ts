import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "../config.js";
import type { SourceDoc, Trend } from "../types.js";
import type { Triage } from "./triage.js";
import { anthropic } from "./client.js";

export const ArticleSchema = z.object({
  headline: z.string(),
  dek: z.string(),
  why_trending: z.string(),
  body_markdown: z.string(),
  key_facts: z.array(z.object({ fact: z.string(), source_numbers: z.array(z.number()) })),
  sources_used: z.array(z.number()),
  tags: z.array(z.string()),
  image_query: z.string(),
});
export type ArticleDraft = z.infer<typeof ArticleSchema>;

const SYSTEM = `You are a careful news explainer writer for WhyTrends.com, read mostly by Americans.
Every article answers one question: why is this topic trending right now?

Rules:
- Use ONLY facts stated in the numbered sources. If sources disagree, say so. Never invent quotes, numbers, names or dates.
- Every key fact must cite the source numbers that support it. Prefer facts supported by two or more sources.
- Write in your own words. Never copy a sentence from a source; quote at most 15 words, in quotation marks, credited to the outlet.
- Add value beyond the sources: plain-language context and background, why people care, and what to watch next.
- Neutral, factual tone. No clickbait, no speculation presented as fact, no medical, legal or financial advice.
- Format: headline under 70 characters; dek is one sentence; why_trending is 2 to 3 sentences that directly answer the question;
  body_markdown is 400 to 700 words with 2 to 4 "##" subheadings and no top-level heading; do not repeat the headline.
- image_query: 2 to 4 generic words for a stock photo (no people's names).`;

export async function writeArticle(trend: Trend, triage: Triage, sources: SourceDoc[]): Promise<ArticleDraft | null> {
  const numbered = sources
    .map((s, i) => `<source n="${i + 1}" outlet="${s.source}" url="${s.url}">\n${s.title}\n\n${s.text}\n</source>`)
    .join("\n\n");
  const res = await anthropic().messages.parse({
    model: config.models.writer,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "medium", format: zodOutputFormat(ArticleSchema) },
    messages: [
      {
        role: "user",
        content: `Trending topic: ${trend.title} (${trend.approxTraffic}+ US searches)\nCategory: ${triage.category}\nAngle: ${triage.angle}\n\n${numbered}`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
  return res.parsed_output ?? null;
}
