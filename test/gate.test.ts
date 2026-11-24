import { describe, expect, it } from "vitest";
import { copiesSource, qualityGate } from "../src/quality/gate.js";
import type { ArticleDraft } from "../src/llm/write.js";
import type { SourceDoc } from "../src/types.js";

const src = (text: string, n: number): SourceDoc => ({ url: `https://s${n}.example`, source: `S${n}`, title: "t", text });
const sources = [
  src("NASA said the total lunar eclipse begins at 2:30 a.m. Eastern and lasts about 65 minutes for viewers in the Americas.", 1),
  src("Skywatchers across the US can see the blood moon early Wednesday, astronomers said, weather permitting.", 2),
];
const body = Array.from({ length: 45 }, (_, i) => `Sentence number ${i} explains context about the eclipse in fresh words.`).join(" ");

const good: ArticleDraft = {
  headline: "Why the lunar eclipse is trending tonight",
  dek: "A total eclipse is visible across the US early Wednesday.",
  why_trending: "Millions of Americans are searching because a total lunar eclipse is visible early Wednesday, the first in over a year.",
  body_markdown: body,
  key_facts: [
    { fact: "Starts 2:30 a.m. ET", source_numbers: [1, 2] },
    { fact: "Lasts about 65 minutes", source_numbers: [1] },
    { fact: "Visible across the US", source_numbers: [1, 2] },
  ],
  sources_used: [1, 2],
  tags: ["space"],
  image_query: "full moon night",
};

describe("quality gate", () => {
  it("passes a well-sourced original article", () => {
    expect(qualityGate(good, sources, false)).toEqual({ pass: true, reasons: [] });
  });

  it("sends sensitive topics to review", () => {
    const r = qualityGate(good, sources, true);
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain("sensitive topic: needs human review");
  });

  it("flags single-source and uncited articles", () => {
    const r = qualityGate({ ...good, sources_used: [1, 9], key_facts: good.key_facts.map((f) => ({ ...f, source_numbers: [7] })) }, sources, false);
    expect(r.reasons).toEqual(expect.arrayContaining(["uses 1 source(s), needs 2+", "a key fact has no valid source"]));
  });

  it("detects copied passages", () => {
    const copied = `${body} NASA said the total lunar eclipse begins at 2:30 a.m. Eastern and lasts about 65 minutes for viewers.`;
    expect(copiesSource(copied, sources)).toBe(true);
    expect(copiesSource(body, sources)).toBe(false);
  });
});
