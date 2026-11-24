import type { ArticleDraft } from "../llm/write.js";
import type { SourceDoc } from "../types.js";

export interface GateResult {
  pass: boolean;
  reasons: string[];
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);

function shingles(tokens: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) out.add(tokens.slice(i, i + n).join(" "));
  return out;
}

/** Longest-run proxy: true if the article shares any run of `n` consecutive words with a source. */
export function copiesSource(body: string, sources: SourceDoc[], n = 12): boolean {
  const mine = shingles(words(body), n);
  return sources.some((s) => [...shingles(words(s.text), n)].some((sh) => mine.has(sh)));
}

export function qualityGate(a: ArticleDraft, sources: SourceDoc[], sensitive: boolean): GateResult {
  const reasons: string[] = [];
  const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= sources.length;

  const used = new Set(a.sources_used.filter(valid));
  if (used.size < 2) reasons.push(`uses ${used.size} source(s), needs 2+`);

  if (a.key_facts.length < 3) reasons.push("fewer than 3 key facts");
  if (a.key_facts.some((f) => !f.source_numbers.some(valid))) reasons.push("a key fact has no valid source");
  const corroborated = a.key_facts.filter((f) => new Set(f.source_numbers.filter(valid)).size >= 2).length;
  if (a.key_facts.length > 0 && corroborated / a.key_facts.length < 0.5) reasons.push("under half the facts are in 2+ sources");

  const wc = words(a.body_markdown).length;
  if (wc < 350 || wc > 950) reasons.push(`body is ${wc} words, expected 350-950`);
  if (a.headline.length > 90) reasons.push("headline too long");
  if (a.why_trending.trim().length < 60) reasons.push("why-trending answer too thin");

  if (copiesSource(a.body_markdown, sources)) reasons.push("copies 12+ consecutive words from a source");
  if (sensitive) reasons.push("sensitive topic: needs human review");

  return { pass: reasons.length === 0, reasons };
}
