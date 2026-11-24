import { config } from "../config.js";

/** Tells the web app to rebuild the article page, home page and sitemap. Best effort. */
export async function revalidateWeb(slug: string): Promise<void> {
  if (!config.webRevalidateUrl) return;
  try {
    await fetch(config.webRevalidateUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.webRevalidateSecret}` },
      body: JSON.stringify({ slug }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.warn(`revalidate failed for ${slug}:`, (err as Error).message);
  }
}
