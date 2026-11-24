import { config } from "../config.js";

export interface LicensedImage {
  url: string;
  credit: string;
  creditUrl: string;
}

/** Licensed stock photo from Pexels (free licence, credit given). Never reuse news-site photos. */
export async function findImage(query: string): Promise<LicensedImage | null> {
  if (!config.pexelsKey || !query.trim()) return null;
  const res = await fetch(
    `https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=${encodeURIComponent(query)}`,
    { headers: { Authorization: config.pexelsKey } },
  );
  if (!res.ok) return null;
  const photo = (await res.json())?.photos?.[0];
  if (!photo) return null;
  return { url: photo.src.large2x ?? photo.src.large, credit: `${photo.photographer} / Pexels`, creditUrl: photo.url };
}
