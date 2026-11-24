export function slugify(s: string, max = 80): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

/** Stable key so the same trend isn't written twice on the same US day. */
export function trendKey(title: string, at: Date): string {
  const day = at.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return `${day}:${slugify(title)}`;
}
