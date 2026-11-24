import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "../config.js";
import type { Trend } from "../types.js";
import { anthropic } from "./client.js";

export const TriageSchema = z.object({
  worth_writing: z.boolean(),
  category: z.enum(["news", "politics", "business", "tech", "sports", "entertainment", "science", "health", "lifestyle", "other"]),
  sensitive: z.boolean(),
  angle: z.string(),
  reason: z.string(),
});
export type Triage = z.infer<typeof TriageSchema>;

const SYSTEM = `You screen Google Trends topics for WhyTrends, a US site that explains why things are trending.
Decide if a topic deserves an explainer article.
- worth_writing=false for: a bare score or schedule with nothing else to explain, duplicates of the same story, adult content, or topics where the headlines give no clear reason for the spike.
- sensitive=true for: deaths, serious crime, health or medical claims, active disasters, elections, minors, or allegations against named people. Sensitive topics always need human review.
- angle: one sentence on what the reader wants to know ("why is X trending").`;

export async function triageTrend(trend: Trend): Promise<Triage | null> {
  const headlines = trend.newsItems.map((n) => `- ${n.title} (${n.source})`).join("\n") || "(no headlines)";
  const res = await anthropic().messages.parse({
    model: config.models.triage,
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(TriageSchema) },
    messages: [{ role: "user", content: `Topic: ${trend.title}\nSearches: ${trend.approxTraffic}+\nHeadlines:\n${headlines}` }],
  });
  if (res.stop_reason === "refusal") return null;
  return res.parsed_output ?? null;
}
